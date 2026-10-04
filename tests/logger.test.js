import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { isPrivateOrReservedIp } from '../src/middleware/logger.js';

// loadLogger gives a fresh copy of the module, because the throttle window is
// module-level state and would otherwise leak between cases.
async function loadLogger() {
  vi.resetModules();
  return import('../src/middleware/logger.js');
}

// Drives the real middleware with a minimal req/res, since the guard is
// reached through requestLogger rather than from any route.
function makeReq(ip) {
  return {
    method: 'GET',
    path: '/api/ward/beds',
    ip,
    connection: { remoteAddress: ip },
    get: () => undefined,
    query: {},
  };
}

function runRequest(logger, ip) {
  const next = vi.fn();
  logger.requestLogger(makeReq(ip), { send: vi.fn() }, next);
  return next;
}

describe('Proxy IP drift guard', () => {
  let warn;
  let log;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Off by default; the cases below that expect a warning turn it on.
    // There is a dedicated test for the default.
    process.env.PROXY_IP_WARN = 'true';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.PROXY_IP_WARN;
  });

  describe('opt-in gate', () => {
    it('should stay silent when PROXY_IP_WARN is unset', async () => {
      // The hospital-LAN default: one fixed proxy address means a private
      // req.ip is expected, and warning about it every boot would just train
      // staff to ignore the log.
      delete process.env.PROXY_IP_WARN;
      const logger = await loadLogger();

      runRequest(logger, '10.25.170.135');
      runRequest(logger, '127.0.0.1');

      expect(warn).not.toHaveBeenCalled();
      // Crucially, the audit log still fires. The gate silences the diagnostic,
      // it does not silence auditing.
      expect(log).toHaveBeenCalledTimes(2);
    });

    it('should stay silent when set to anything but "true"', async () => {
      const logger = await loadLogger();

      for (const value of ['false', '1', 'yes', 'TRUE']) {
        process.env.PROXY_IP_WARN = value;
        runRequest(logger, '10.25.170.135');
      }

      expect(warn).not.toHaveBeenCalled();
    });

    it('should still call next when disabled', async () => {
      delete process.env.PROXY_IP_WARN;
      const logger = await loadLogger();

      const next = runRequest(logger, '10.25.170.135');

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('isPrivateOrReservedIp', () => {
    it('should flag loopback, private, link-local, CGNAT and reserved ranges', () => {
      const flagged = [
        '127.0.0.1', // loopback
        '::1', // IPv6 loopback
        '::ffff:127.0.0.1', // how Node reports localhost
        '10.25.170.135', // the Render edge that prompted this guard
        '10.0.0.1',
        '172.16.0.1', // 172.16/12 lower bound
        '172.31.255.255', // 172.16/12 upper bound
        '192.168.1.1',
        '169.254.1.1', // link-local
        '100.64.0.1', // CGNAT
        '0.0.0.0', // "this network"
        '224.0.0.1', // multicast
        '240.0.0.1', // reserved
        'fd00::1', // unique-local
        'fe80::1', // IPv6 link-local
      ];
      for (const ip of flagged) {
        expect(isPrivateOrReservedIp(ip), `${ip} should be flagged`).toBe(true);
      }
    });

    it('should not flag routable client addresses', () => {
      const clean = [
        '196.189.144.13', // the real client seen on Render
        '8.8.8.8',
        '1.1.1.1',
        '172.32.0.1', // just outside 172.16/12
        '172.15.255.255', // just below 172.16/12
        '100.63.255.255', // just below CGNAT
        '100.128.0.1', // just above CGNAT
        '223.255.255.255', // just below multicast
        '2606:4700:4700::1111', // Cloudflare public DNS v6
        '2001:4860:4860::8888',
      ];
      for (const ip of clean) {
        expect(isPrivateOrReservedIp(ip), `${ip} should not be flagged`).toBe(false);
      }
    });

    it('should ignore unparseable or missing values', () => {
      // Not this guard's job to report -- an unparseable address is a
      // different problem, and flagging it would misdirect the reader.
      for (const value of ['', undefined, null, 'unknown', 'not-an-ip', 12345, {}]) {
        expect(isPrivateOrReservedIp(value)).toBe(false);
      }
    });
  });

  describe('warning behaviour', () => {
    it('should warn once when req.ip resolves to a proxy address', async () => {
      const logger = await loadLogger();

      // trust proxy = 1 resolving to Render's internal edge: the exact drift
      // this guard exists to surface.
      runRequest(logger, '10.25.170.135');

      expect(warn).toHaveBeenCalledTimes(1);
      const [message, detail] = warn.mock.calls[0];
      expect(message).toContain('10.25.170.135');
      expect(message).toContain('PROXY-IP');
      expect(detail.ip).toBe('10.25.170.135');
      expect(detail.hint).toContain('trust proxy');
    });

    it('should not warn per request within the interval', async () => {
      const logger = await loadLogger();

      // The failure mode is widespread, so a per-request warning would flood
      // the log precisely when the problem is worst.
      for (let i = 0; i < 200; i += 1) {
        runRequest(logger, '10.25.170.135');
      }
      expect(warn).toHaveBeenCalledTimes(1);

      // Still suppressed just under five minutes later.
      vi.advanceTimersByTime(4 * 60 * 1000 + 59 * 1000);
      runRequest(logger, '10.25.170.135');
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('should warn again once the interval has elapsed', async () => {
      const logger = await loadLogger();

      runRequest(logger, '10.25.170.135');
      expect(warn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(5 * 60 * 1000);
      runRequest(logger, '10.25.170.135');
      expect(warn).toHaveBeenCalledTimes(2);
    });

    it('should not warn when req.ip is the real client', async () => {
      const logger = await loadLogger();

      runRequest(logger, '196.189.144.13');

      expect(warn).not.toHaveBeenCalled();
      // The normal request log must still fire, otherwise a mistake here would
      // silence the audit trail entirely.
      expect(log).toHaveBeenCalled();
    });

    it('should keep logging every request regardless of the warning', async () => {
      const logger = await loadLogger();

      runRequest(logger, '10.25.170.135');
      runRequest(logger, '10.25.170.135');
      runRequest(logger, '10.25.170.135');

      // Throttling the warning must not throttle the audit log -- that is a
      // separate and unconditional record.
      expect(log).toHaveBeenCalledTimes(3);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('should still call next so requests are never blocked', async () => {
      const logger = await loadLogger();

      const next = runRequest(logger, '10.25.170.135');

      // This guard is diagnostic only. Throwing or short-circuiting here would
      // turn a logging problem into an outage.
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});