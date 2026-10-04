import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import { initTestDb, getTestDb, cleanupTestDb } from './setup.js';
import './test-env.js';
import app from '../src/server.js';

initTestDb();

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Canary values, one per sensitive field. Unique so a leak identifies which
 * field escaped rather than just that something did. Shaped like real
 * credentials so they cannot be dismissed as obvious placeholders.
 */
const CANARY = {
  password: 'C4nary-Passw0rd-a1b2c3d4',
  password_hash: 'C4nary-Hash-e5f6g7h8',
  token: 'C4nary-Token-i9j0k1l2',
  authorization: 'C4nary-Auth-m3n4o5p6',
  secret: 'C4nary-Secret-q7r8s9t0',
  api_key: 'C4nary-ApiKey-u1v2w3x4',
};

/**
 * The same secrets placed where a shallow redaction misses them.
 *
 * Every value here is one of the CANARY values above, so a single scan of the
 * log output proves whether any shape escaped. Depths 1-4, nesting styles a
 * real API would produce, and the three casings a codebase mixes freely.
 */
const NESTED = {
  // depth 1 -- an object wrapper, the most common shape by far
  depth1: { user: { password: CANARY.password } },
  // depth 2 -- a wrapper inside a wrapper
  depth2: { account: { profile: { password: CANARY.password } } },
  // depth 3
  depth3: { a: { b: { c: { token: CANARY.token } } } },
  // depth 4 -- beyond the cap the sanitizer applies
  depth4: { a: { b: { c: { d: { secret: CANARY.secret } } } } },

  // arrays of objects, and an object inside an array inside an object
  arrayOfObjects: { users: [{ password: CANARY.password }, { token: CANARY.token }] },
  arrayInArray: { batch: [[{ api_key: CANARY.api_key }]] },
  objectHoldingArray: { payload: { items: [{ secret: CANARY.secret }] } },

  // casing variants that a literal string comparison misses
  camelCase: { apiKey: CANARY.api_key, clientSecret: CANARY.secret, accessToken: CANARY.token },
  pascalCase: { Password: CANARY.password, ApiKey: CANARY.api_key },
  kebabCase: { 'api-key': CANARY.api_key, 'client-secret': CANARY.secret },
  snakeCase: { password_hash: CANARY.password_hash, access_token: CANARY.token },

  // names the API might plausibly use that still mean "credential"
  subfields: { passwordHash: CANARY.password_hash, authorization_header: CANARY.authorization },
  credentialsObject: { credentials: { password: CANARY.password, token: CANARY.token } },
};

const NESTED_CANARY_VALUES = [
  CANARY.password,
  CANARY.token,
  CANARY.secret,
  CANARY.api_key,
  CANARY.password_hash,
  CANARY.authorization,
];

/**
 * Every route in the app, with its full mount path.
 *
 * Express 5 does not keep a router layer's mount path on the layer: `path` is
 * only populated as a side effect of a request matching through it, and the
 * matcher closure does not retain the original string. Mount prefixes are
 * therefore recovered by asking each router layer to match the app.use('...')
 * literals declared in src/server.js. The reconciliation assertion below fails
 * if any router cannot be resolved, so a newly mounted module can never be
 * silently skipped -- which would turn this from enforcement into an audit.
 */
function enumerateRoutes() {
  const source = readFileSync(join(ROOT, 'src', 'server.js'), 'utf8');
  const prefixes = [...source.matchAll(/app\.use\(\s*'([^']+)'/g)].map((m) => m[1]);

  const unresolved = [];
  const routes = [];

  function walk(layers, prefix = '') {
    for (const layer of layers || []) {
      if (layer.route) {
        for (const method of Object.keys(layer.route.methods || {})) {
          routes.push({
            method: method.toUpperCase(),
            path: prefix + (layer.route.path === '/' ? '' : layer.route.path),
          });
        }
      } else if (layer.name === 'router' && layer.handle?.stack) {
        let mount = prefix;
        if (!layer.path) {
          const hit = prefixes.find((p) => layer.match(p));
          if (hit) {
            mount = hit;
          } else {
            unresolved.push('router with no resolvable mount prefix');
          }
        } else {
          mount = prefix + layer.path;
        }
        walk(layer.handle.stack, mount.endsWith('/') ? mount.slice(0, -1) : mount);
      }
    }
  }

  walk(app.router?.stack || app._router?.stack);
  return { routes, unresolved };
}

describe('No credential ever reaches a log sink', () => {
  let adminToken;

  beforeAll(() => {
    const db = getTestDb();
    cleanupTestDb();
    db.prepare(
      "INSERT INTO users (username, password_hash, full_name, role, department) VALUES ('leak.probe','x','Leak Probe','SuperAdmin','Administration')"
    ).run();
    adminToken = jwt.sign(
      { id: 1, username: 'leak.probe', role: 'SuperAdmin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(() => {
    cleanupTestDb();
  });

  it('should resolve the mount path for every router, so no route is skipped', () => {
    const { routes, unresolved } = enumerateRoutes();

    // The enforcement guarantee depends on covering every route. If a router
    // cannot be resolved this fails loudly rather than quietly narrowing the
    // sweep and letting a leak through.
    expect(
      unresolved,
      'every router must resolve to a mount prefix or this test enforces nothing'
    ).toEqual([]);

    // Sanity floor: the API has long since outgrown this. A collapse would mean
    // enumeration silently broke and the sweep passed vacuously.
    expect(routes.length).toBeGreaterThan(100);
    expect(routes.filter((r) => r.path.startsWith('/api/')).length).toBeGreaterThan(100);
  });

  it('should not log a credential for any route in the app', async () => {
    const { routes } = enumerateRoutes();
    expect(routes.length).toBeGreaterThan(100);

    const logOutput = [];
    for (const method of ['log', 'warn', 'error', 'info', 'debug']) {
      vi.spyOn(console, method).mockImplementation((...args) => {
        logOutput.push(args);
      });
    }

    const leaks = [];

    for (const route of routes) {
      // Params become a benign placeholder. The property under test concerns
      // the body, so a synthetic id is enough to reach the handler and any
      // middleware attached to it.
      const path = route.path.replace(/:[A-Za-z_]+/g, '1');
      logOutput.length = 0;

      try {
        await request(app)
          [route.method.toLowerCase()](path)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ ...CANARY });
      } catch {
        // A route that throws is not itself a leak; the assertion below runs
        // regardless of the response status.
      }

      const serialised = JSON.stringify(logOutput);
      for (const [field, value] of Object.entries(CANARY)) {
        if (serialised.includes(value)) {
          leaks.push(`${route.method} ${route.path} leaked "${field}"`);
        }
      }
    }

    vi.restoreAllMocks();

    expect(
      leaks,
      `credential values reached a console log:\n${leaks.join('\n')}`
    ).toEqual([]);
  }, 180000);

  it('should not persist a credential into the audit trail', async () => {
    const { routes } = enumerateRoutes();
    cleanupTestDb();

    for (const route of routes) {
      if (route.method === 'GET') continue;
      const path = route.path.replace(/:[A-Za-z_]+/g, '1');
      try {
        await request(app)
          [route.method.toLowerCase()](path)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ ...CANARY });
      } catch {
        // Outcome is irrelevant; what lands in the row is what is asserted.
      }
    }

    // The audit middleware serialises the entire request body into `details`
    // and does not redact. Nothing currently routes a password field through
    // it; this asserts that stays true across the whole API.
    const rows = getTestDb()
      .prepare('SELECT details FROM audit_logs WHERE details IS NOT NULL')
      .all();

    const leaky = [];
    for (const row of rows) {
      for (const [field, value] of Object.entries(CANARY)) {
        if (row.details.includes(value)) {
          leaky.push(`audit_logs.details leaked "${field}"`);
        }
      }
    }

    expect(
      leaky,
      `audit_logs persisted a credential:\n${leaky.join('\n')}`
    ).toEqual([]);
  }, 180000);

  it('should redact a nested, array or camelCase credential at any depth', async () => {
    const logged = [];
    for (const method of ['log', 'warn', 'error']) {
      vi.spyOn(console, method).mockImplementation((...args) => logged.push(args));
    }

    const { requestLogger } = await import('../src/middleware/logger.js');

    const escaped = [];
    for (const [label, body] of Object.entries(NESTED)) {
      logged.length = 0;
      requestLogger(
        {
          method: 'POST',
          path: '/probe',
          ip: '127.0.0.1',
          connection: { remoteAddress: '127.0.0.1' },
          get: () => undefined,
          query: {},
          body,
        },
        { send() {} },
        () => {}
      );

      const serialised = JSON.stringify(logged);
      for (const value of NESTED_CANARY_VALUES) {
        if (serialised.includes(value)) {
          escaped.push(`${label} leaked ${value}`);
          break;
        }
      }
    }

    vi.restoreAllMocks();

    expect(
      escaped,
      `nested credentials reached the log:\n${escaped.join('\n')}`
    ).toEqual([]);
  });

  it('should not mutate the original request body', async () => {
    const { requestLogger } = await import('../src/middleware/logger.js');

    // Sanitising in place would corrupt the body the route handler still has to
    // read: the handler would receive [REDACTED] instead of the real value.
    const original = {
      password: CANARY.password,
      user: { token: CANARY.token },
      users: [{ apiKey: CANARY.api_key }],
    };
    const snapshot = JSON.parse(JSON.stringify(original));

    vi.spyOn(console, 'log').mockImplementation(() => {});
    requestLogger(
      {
        method: 'POST',
        path: '/probe',
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' },
        get: () => undefined,
        query: {},
        body: original,
      },
      { send() {} },
      () => {}
    );
    vi.restoreAllMocks();

    expect(original).toEqual(snapshot);
    expect(original.password).toBe(CANARY.password);
  });

  it('should stop descending at the depth cap rather than recursing forever', async () => {
    const { requestLogger } = await import('../src/middleware/logger.js');

    // A pathologically deep body must not hang the logger or blow the stack.
    let deep = { secret: CANARY.secret };
    for (let i = 0; i < 40; i += 1) deep = { nested: deep };

    const logged = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => logged.push(args));

    const started = Date.now();
    expect(() =>
      requestLogger(
        {
          method: 'POST',
          path: '/probe',
          ip: '127.0.0.1',
          connection: { remoteAddress: '127.0.0.1' },
          get: () => undefined,
          query: {},
          body: deep,
        },
        { send() {} },
        () => {}
      )
    ).not.toThrow();
    const elapsed = Date.now() - started;

    vi.restoreAllMocks();

    expect(elapsed, 'sanitizing a deeply nested body must be fast').toBeLessThan(1000);
    // It must still have logged something rather than silently bailing out.
    expect(logged.length).toBeGreaterThan(0);
  });
});