/**
 * Boots a fully isolated hospital instance for the browser E2E suite.
 *
 * Each run gets its own temporary SQLite file and its own port, so E2E never
 * touches (or depends on) the developer's hospital.db and can run alongside a
 * dev server on port 3000.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');

/** Ask the OS for a free port so parallel runs cannot collide. */
function freePort() {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.on('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
  });
}

/**
 * Build a fresh database, then run the real server against it.
 *
 * `scripts/resetDemoDb.js` does schema.sql -> migrations -> both seeds in the
 * only order that works, which is also exactly what production boot does. Using
 * it here means the E2E suite exercises the real bootstrap path rather than a
 * hand-rolled fixture.
 */
export async function startServer({ seed = true } = {}) {
  if (!existsSync(join(PROJECT_ROOT, 'frontend', 'dist', 'index.html'))) {
    throw new Error(
      'frontend/dist/index.html is missing. Run `npm run build` first ' +
        '(or use `npm run test:e2e`, which builds automatically).'
    );
  }

  const port = await freePort();
  const workdir = mkdtempSync(join(tmpdir(), 'hms-e2e-db-'));
  const dbPath = join(workdir, 'hospital.db');
  const baseUrl = `http://127.0.0.1:${port}`;

  if (seed) {
    const seeded = spawnSync(process.execPath, [join(PROJECT_ROOT, 'scripts', 'resetDemoDb.js')], {
      env: { ...process.env, DB_PATH: dbPath },
      encoding: 'utf-8',
    });
    if (seeded.status !== 0) {
      throw new Error(
        `Failed to seed the E2E database (exit ${seeded.status}):\n` +
          `${seeded.stdout || ''}${seeded.stderr || ''}`
      );
    }
  }

  const child = spawn(process.execPath, [join(PROJECT_ROOT, 'src', 'server.js')], {
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: dbPath,
      // Production demands an explicit secret; development has a default. The
      // suite runs in development mode so no real secret is needed.
      NODE_ENV: 'test',
      JWT_SECRET: process.env.JWT_SECRET || 'e2e-secret',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let log = '';
  child.stdout.on('data', (d) => {
    log += d.toString();
  });
  child.stderr.on('data', (d) => {
    log += d.toString();
  });

  // Poll /api/health rather than trusting a fixed boot delay.
  let healthy = false;
  for (let attempt = 0; attempt < 80 && !healthy; attempt++) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early (code ${child.exitCode}):\n${log}`);
    }
    await sleep(250);
    healthy = await fetch(`${baseUrl}/api/health`)
      .then((r) => r.ok)
      .catch(() => false);
  }
  if (!healthy) {
    child.kill('SIGKILL');
    throw new Error(`Server did not become healthy in time:\n${log}`);
  }

  const stop = () => {
    child.kill('SIGKILL');
    rmSync(workdir, { recursive: true, force: true });
  };

  return { baseUrl, port, dbPath, stop, getLog: () => log };
}