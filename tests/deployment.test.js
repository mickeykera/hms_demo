import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

import { resolveTrustProxy } from '../src/config/trustProxy.js';
import { assertDemoFlagsAllowed, envFlag, isDemoMode } from '../src/config/deploymentMode.js';

// Builds a minimal app wired exactly like src/server.js wires the real one:
// trust proxy from TRUST_PROXY, then expose req.ip. A separate app is used
// rather than re-importing the real one because trust proxy is read once at
// import time and the whole point here is to vary it.
function buildApp(env) {
  const app = express();
  app.set('trust proxy', resolveTrustProxy(env.TRUST_PROXY).trustProxy);
  app.get('/whoami', (req, res) => res.json({ ip: req.ip }));
  return app;
}

describe('Deployment configuration', () => {
  describe('resolveTrustProxy', () => {
    it('should trust nothing when unset', () => {
      // The on-prem default. Ignoring X-Forwarded-For outright is what makes a
      // forged header useless on a hospital LAN.
      expect(resolveTrustProxy(undefined).trustProxy).toBe(false);
      expect(resolveTrustProxy(null).trustProxy).toBe(false);
      expect(resolveTrustProxy('').trustProxy).toBe(false);
      expect(resolveTrustProxy('  ').trustProxy).toBe(false);
    });

    it('should treat explicit off values as disabled', () => {
      for (const value of ['false', 'FALSE', 'none', 'off', '0']) {
        expect(resolveTrustProxy(value).trustProxy, value).toBe(false);
      }
    });

    it('should parse a hop count', () => {
      expect(resolveTrustProxy('3').trustProxy).toBe(3);
      expect(resolveTrustProxy('1').trustProxy).toBe(1);
      expect(resolveTrustProxy(' 2 ').trustProxy).toBe(2);
      expect(resolveTrustProxy('3').description).toBe('3 hops');
      expect(resolveTrustProxy('1').description).toBe('1 hop');
    });

    it('should accept the trust-everything forms but mark them risky', () => {
      // Accepted because they are legitimate, but each lets a client forge its
      // own IP, so the description has to say so and server.js warns at startup.
      const permissive = resolveTrustProxy('true');
      expect(permissive.trustProxy).toBe(true);
      expect(permissive.description).toMatch(/TRUE.*left-most entry wins/);

      expect(resolveTrustProxy('loopback').trustProxy).toBe(true);
      expect(resolveTrustProxy('hop').trustProxy).toBe('hop');

      // A hop count carries no such caveat, which is exactly why it is preferred.
      expect(resolveTrustProxy('3').description).not.toMatch(/TRUE/);
    });

    it('should accept a subnet or subnet list', () => {
      expect(resolveTrustProxy('10.0.0.0/8').trustProxy).toBe('10.0.0.0/8');
      expect(resolveTrustProxy('10.0.0.0/8,192.168.0.0/16').trustProxy).toEqual([
        '10.0.0.0/8',
        '192.168.0.0/16',
      ]);
    });

    it('should reject an implausible hop count rather than clamp it', () => {
      // Express silently clamps a huge number, which would quietly become
      // "trust everything". A typo must fail loudly instead.
      expect(() => resolveTrustProxy('999')).toThrow(/not a plausible hop count/);
      expect(() => resolveTrustProxy('65')).toThrow(/not a plausible hop count/);
    });

    it('should reject unparseable values with an actionable message', () => {
      expect(() => resolveTrustProxy('yes')).toThrow(/not a value I understand/);
      expect(() => resolveTrustProxy('-1')).toThrow(/not a value I understand/);
      expect(() => resolveTrustProxy('3.5')).toThrow();
    });
  });

  describe('req.ip with TRUST_PROXY unset (hospital LAN)', () => {
    let app;

    beforeEach(() => {
      app = buildApp({});
    });

    afterEach(() => {
      app = null;
    });

    it('should ignore a forged X-Forwarded-For entirely', async () => {
      const forged = '9.9.9.9, 8.8.8.8, 1.1.1.1';

      const res = await request(app).get('/whoami').set('X-Forwarded-For', forged);

      // The socket address, never anything from the header. This is the case
      // that matters on a LAN: a client cannot pick its own audit identity.
      expect(res.body.ip).not.toBe('9.9.9.9');
      expect(res.body.ip).not.toBe('8.8.8.8');
      expect(res.body.ip).not.toBe('1.1.1.1');
      expect(res.body.ip).toMatch(/^(::1|::ffff:127\.0\.0\.1|127\.0\.0\.1)$/);
    });

    it('should resolve the same address regardless of what the client claims', async () => {
      // Every header value yields the same req.ip, so a forger cannot mint a
      // separate rate-limit bucket by varying it.
      const spoofA = await request(app).get('/whoami').set('X-Forwarded-For', '9.9.9.9');
      const spoofB = await request(app).get('/whoami').set('X-Forwarded-For', '203.0.113.5, 8.8.8.8');
      const spoofC = await request(app).get('/whoami').set('X-Forwarded-For', '');

      expect(spoofA.body.ip).toBe(spoofB.body.ip);
      expect(spoofB.body.ip).toBe(spoofC.body.ip);
    });
  });
  describe('req.ip with TRUST_PROXY=3 (Render demo)', () => {
    let app;

    beforeEach(() => {
      app = buildApp({ TRUST_PROXY: '3' });
    });

    it('should resolve the real client from the observed chain', async () => {
      const res = await request(app)
        .get('/whoami')
        .set('X-Forwarded-For', '196.189.144.13, 172.71.151.201, 10.25.170.135');

      expect(res.body.ip).toBe('196.189.144.13');
    });

    it('should ignore a client-prepended forged address', async () => {
      const res = await request(app)
        .get('/whoami')
        .set('X-Forwarded-For', '9.9.9.9, 198.51.100.77, 172.71.151.201, 10.25.170.135');

      // X-Forwarded-For is append-only, so a client value can only appear on the
      // left. Reading a fixed offset from the right means the forgery shifts the
      // chain without changing what is trusted.
      expect(res.body.ip).toBe('198.51.100.77');
    });
  });

  describe('deployment mode', () => {
    it('should default to onprem when unset', () => {
      // Fail-closed: an install that never set the mode must not come up with
      // demo conveniences available.
      expect(isDemoMode({})).toBe(false);
      expect(isDemoMode({ DEPLOYMENT_MODE: '' })).toBe(false);
      expect(isDemoMode({ DEPLOYMENT_MODE: 'onprem' })).toBe(false);
      expect(isDemoMode({ DEPLOYMENT_MODE: 'ONPREM' })).toBe(false);
    });

    it('should recognise demo mode', () => {
      expect(isDemoMode({ DEPLOYMENT_MODE: 'demo' })).toBe(true);
      expect(isDemoMode({ DEPLOYMENT_MODE: 'DEMO' })).toBe(true);
      expect(isDemoMode({ DEPLOYMENT_MODE: ' demo ' })).toBe(true);
    });

    it('should reject an unknown mode instead of guessing', () => {
      // Guessing here means guessing at whether unauthenticated admin access
      // is acceptable, so an unknown value must not fall back to a default.
      expect(() => isDemoMode({ DEPLOYMENT_MODE: 'staging' })).toThrow(/DEPLOYMENT_MODE must be one of/);
      expect(() => isDemoMode({ DEPLOYMENT_MODE: 'production' })).toThrow();
    });

    it('should only accept the exact string "true" for a flag', () => {
      expect(envFlag('X', { X: 'true' })).toBe(true);
      // A flag that opens unauthenticated admin access should not be turnable
      // on by accident.
      for (const value of ['1', 'yes', 'TRUE', 'True', 'on', 'true ', '']) {
        expect(envFlag('X', { X: value }), `"${value}"`).toBe(false);
      }
      expect(envFlag('X', {})).toBe(false);
    });
  });
  describe('demo flags in an on-prem profile', () => {
    it('should allow a clean onprem environment', () => {
      expect(() => assertDemoFlagsAllowed({ DEPLOYMENT_MODE: 'onprem' })).not.toThrow();
      expect(() => assertDemoFlagsAllowed({})).not.toThrow();
    });

    it('should refuse DEMO_QUICK_LOGIN outside demo mode', () => {
      expect(() =>
        assertDemoFlagsAllowed({ DEPLOYMENT_MODE: 'onprem', DEMO_QUICK_LOGIN: 'true' })
      ).toThrow(/Refusing to start[\s\S]*DEMO_QUICK_LOGIN/);
    });

    it('should refuse SEED_DEMO_DATA outside demo mode', () => {
      expect(() =>
        assertDemoFlagsAllowed({ DEPLOYMENT_MODE: 'onprem', SEED_DEMO_DATA: 'true' })
      ).toThrow(/Refusing to start[\s\S]*SEED_DEMO_DATA/);
    });

    it('should refuse with an unset mode too', () => {
      // The default profile is onprem, so an install that set only the demo
      // flag and nothing else is caught.
      expect(() => assertDemoFlagsAllowed({ DEMO_QUICK_LOGIN: 'true' })).toThrow(/Refusing to start/);
      expect(() => assertDemoFlagsAllowed({ SEED_DEMO_DATA: 'true' })).toThrow(/Refusing to start/);
    });

    it('should name both flags when both are set', () => {
      let message = '';
      try {
        assertDemoFlagsAllowed({ DEMO_QUICK_LOGIN: 'true', SEED_DEMO_DATA: 'true' });
      } catch (err) {
        message = err.message;
      }
      expect(message).toContain('DEMO_QUICK_LOGIN');
      expect(message).toContain('SEED_DEMO_DATA');
      // The message must tell the operator how to proceed.
      expect(message).toContain('DEPLOYMENT_MODE=demo');
    });

    it('should ignore the flags when set to a non-true value', () => {
      // "false" is the correct off switch and must not trip the guard.
      expect(() =>
        assertDemoFlagsAllowed({
          DEPLOYMENT_MODE: 'onprem',
          DEMO_QUICK_LOGIN: 'false',
          SEED_DEMO_DATA: 'false',
        })
      ).not.toThrow();
    });

    it('should permit both flags in demo mode', () => {
      expect(() =>
        assertDemoFlagsAllowed({
          DEPLOYMENT_MODE: 'demo',
          DEMO_QUICK_LOGIN: 'true',
          SEED_DEMO_DATA: 'true',
        })
      ).not.toThrow();
    });
  });
});