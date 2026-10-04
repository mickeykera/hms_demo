import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  IDLE_TIMEOUT_MS,
  ACTIVITY_EVENTS,
  isIdleExpired,
  remainingIdleMs,
  createIdleSession,
} from '../frontend/src/utils/idleSession.js';

const MINUTE = 60 * 1000;

describe('idle session timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isIdleExpired', () => {
    it('should not expire immediately on sign-in', () => {
      expect(isIdleExpired(Date.now())).toBe(false);
    });

    it('should not expire just under the timeout', () => {
      const start = Date.now();
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1000);
      expect(isIdleExpired(start)).toBe(false);
    });

    it('should expire exactly at the timeout', () => {
      const start = Date.now();
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
      expect(isIdleExpired(start)).toBe(true);
    });

    it('should expire after the timeout', () => {
      const start = Date.now();
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS + 1);
      expect(isIdleExpired(start)).toBe(true);
    });

    it('should respect a custom timeout', () => {
      const start = Date.now();
      vi.advanceTimersByTime(31 * MINUTE);
      // Still inside a 45-minute window...
      expect(isIdleExpired(start, Date.now(), 45 * MINUTE)).toBe(false);
      // ...and expired once past it.
      vi.advanceTimersByTime(15 * MINUTE);
      expect(isIdleExpired(start, Date.now(), 45 * MINUTE)).toBe(true);
      // A longer window would still consider the same gap safe.
      expect(isIdleExpired(start, Date.now(), 90 * MINUTE)).toBe(false);
    });

    it('should treat a missing or invalid activity time as expired', () => {
      // Fail closed: an unreadable timestamp must not grant a session.
      expect(isIdleExpired(null)).toBe(true);
      expect(isIdleExpired(undefined)).toBe(true);
      expect(isIdleExpired('nonsense')).toBe(true);
      expect(isIdleExpired(NaN)).toBe(true);
    });
  });

  describe('remainingIdleMs', () => {
    it('should count down to zero', () => {
      const start = Date.now();
      vi.advanceTimersByTime(5 * MINUTE);
      expect(remainingIdleMs(start)).toBe(IDLE_TIMEOUT_MS - 5 * MINUTE);
    });

    it('should never report a negative remainder', () => {
      const start = Date.now();
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS + MINUTE);
      expect(remainingIdleMs(start)).toBe(0);
    });
  });

  describe('createIdleSession', () => {
    let session;

    afterEach(() => {
      session?.stop();
    });

    it('should reset the clock on activity', () => {
      const onTimeout = vi.fn();
      session = createIdleSession({ onTimeout, now: () => Date.now() });

      session.recordActivity();
      vi.advanceTimersByTime(10 * MINUTE);
      session.recordActivity();
      vi.advanceTimersByTime(10 * MINUTE);

      // 20 minutes total, but no 15-minute idle gap.
      expect(onTimeout).not.toHaveBeenCalled();
    });

    it('should fire once the idle gap is reached', () => {
      const onTimeout = vi.fn();
      session = createIdleSession({ onTimeout, now: () => Date.now() });

      vi.advanceTimersByTime(IDLE_TIMEOUT_MS + 1000);

      expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    it('should fire exactly once, not on every timer tick', () => {
      const onTimeout = vi.fn();
      session = createIdleSession({ onTimeout, now: () => Date.now() });

      vi.advanceTimersByTime(IDLE_TIMEOUT_MS + 10 * MINUTE);

      expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    it('should not fire again after it has fired', () => {
      const onTimeout = vi.fn();
      session = createIdleSession({ onTimeout, now: () => Date.now() });

      vi.advanceTimersByTime(IDLE_TIMEOUT_MS + 1000);
      session.recordActivity();
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS + 1000);

      // A user who signs in again after being logged out is on a new session,
      // so a second expiry is legitimate. But one idle gap yields one call.
      expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    it('should stop firing once stopped', () => {
      const onTimeout = vi.fn();
      session = createIdleSession({ onTimeout, now: () => Date.now() });

      session.stop();
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS + MINUTE);

      expect(onTimeout).not.toHaveBeenCalled();
    });

    it('should survive an onTimeout that throws', () => {
      const onTimeout = vi.fn(() => {
        throw new Error('logout blew up');
      });
      session = createIdleSession({ onTimeout, now: () => Date.now() });

      // A throwing callback must not leave the timer wedged or take the tab down.
      expect(() => vi.advanceTimersByTime(IDLE_TIMEOUT_MS + 1000)).not.toThrow();
    });
  });

  describe('the activity event list', () => {
    it('should include the events a clinician actually generates', () => {
      // Typing a clinical note produces mousemove, keydown and input; scrolling
      // a results list produces scroll. If any were missing, a user reading
      // rather than touching the keyboard would be logged out mid-task.
      for (const event of ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']) {
        expect(ACTIVITY_EVENTS, `${event} should count as activity`).toContain(event);
      }
    });

    it('should not treat passive events as activity', () => {
      // A page that polls on a timer must not keep a session alive, and neither
      // should a stray focus event while someone walks past the workstation.
      for (const event of ['focus', 'blur', 'visibilitychange']) {
        expect(ACTIVITY_EVENTS).not.toContain(event);
      }
    });
  });
});