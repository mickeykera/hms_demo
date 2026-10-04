// Idle session timeout -- client side only.
//
// SCOPE, DELIBERATELY NARROW: this signs the user out of the BROWSER after 15
// minutes without input. It does not invalidate the token server-side. A
// stolen token remains valid until its 8h expiry.
//
// That limitation is accepted for now, deliberately. Real server-side idle
// enforcement means changing what the auth middleware trusts and how long
// tokens live, which is a larger change to the auth path and wants its own
// review rather than being folded into a timeout ticket. Until then, the
// realistic threat this addresses is a clinician who walks away from a shared
// workstation -- the single most common way patient data is exposed in a
// hospital -- and that is entirely a browser-side problem.
//
// Note the honest caveat: closing the laptop lid without logging out leaves a
// still-authenticated browser. A browser tab restored from a previous session
// keeps its token in localStorage and would need this timer to have been
// running.

/** Fifteen minutes, per the agreed policy for a shared clinical workstation. */
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Events that count as a user being present.
 *
 * Deliberately excludes focus, blur and visibilitychange. A workstation that
 * loses and regains focus -- someone walking past, a screensaver waking --
 * would otherwise silently keep every session alive, which defeats the point.
 * mousemove, keydown, scroll and touchstart are what actually reading and
 * typing in a clinical UI produce.
 */
export const ACTIVITY_EVENTS = Object.freeze([
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
]);

/**
 * True when the last activity is older than the timeout.
 *
 * Fails closed: a missing, unparseable or NaN timestamp counts as expired, so
 * a broken value can never grant an open-ended session.
 */
export function isIdleExpired(lastActivityMs, nowMs = Date.now(), timeoutMs = IDLE_TIMEOUT_MS) {
  if (typeof lastActivityMs !== 'number' || !Number.isFinite(lastActivityMs)) return true;
  return nowMs - lastActivityMs >= timeoutMs;
}

/** Milliseconds left before expiry, never negative. */
export function remainingIdleMs(lastActivityMs, nowMs = Date.now(), timeoutMs = IDLE_TIMEOUT_MS) {
  if (typeof lastActivityMs !== 'number' || !Number.isFinite(lastActivityMs)) return 0;
  return Math.max(0, timeoutMs - (nowMs - lastActivityMs));
}

/**
 * Creates a session that fires `onTimeout` once a continuous idle gap reaches
 * the timeout.
 *
 * Polls rather than scheduling an exact timer: a long `setTimeout` is throttled
 * or dropped outright in a background tab, so a user returning to a tab left
 * open overnight would never be logged out.
 */
export function createIdleSession({
  onTimeout,
  timeoutMs = IDLE_TIMEOUT_MS,
  now = () => Date.now(),
  pollMs = 30 * 1000,
} = {}) {
  let lastActivity = now();
  let fired = false;
  let timer = null;

  const check = () => {
    if (fired) return;
    if (!isIdleExpired(lastActivity, now(), timeoutMs)) return;
    fired = true;
    try {
      onTimeout?.();
    } catch {
      // A logout that throws must not wedge the timer or take the tab down with
      // an unhandled rejection. The session is already marked fired, so the
      // user is never left in a half-logged-out state that keeps retrying.
    }
  };

  if (typeof setInterval === 'function') {
    timer = setInterval(check, pollMs);
    // Never hold a Node process open (tests, and any script importing this).
    timer?.unref?.();
  }

  return {
    recordActivity() {
      lastActivity = now();
    },
    lastActivity: () => lastActivity,
    stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}