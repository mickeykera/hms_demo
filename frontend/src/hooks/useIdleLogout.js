import { useEffect, useRef } from 'react';
import {
  ACTIVITY_EVENTS,
  createIdleSession,
} from '../utils/idleSession';

/**
 * Signs the user out after `timeoutMs` without input.
 *
 * Attaches listeners to the window rather than to a component, because the
 * timer has to keep running while the clinician is on any screen -- a nurse
 * reading a results list is not touching the component that mounted this.
 */
export function useIdleLogout(logout, timeoutMs) {
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  useEffect(() => {
    if (typeof window === 'undefined' || !logoutRef.current) return undefined;

    const session = createIdleSession({
      timeoutMs,
      onTimeout: () => logoutRef.current(),
    });

    const handlers = ACTIVITY_EVENTS.map((event) => {
      const handler = () => session.recordActivity();
      window.addEventListener(event, handler, { passive: true });
      return { event, handler };
    });

    return () => {
      session.stop();
      for (const { event, handler } of handlers) {
        window.removeEventListener(event, handler);
      }
    };
  }, [timeoutMs]);
}

export default useIdleLogout;