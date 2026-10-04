// Deployment profile.
//
// The same image runs as a public sales demo on Render and as a real hospital
// system on a hospital LAN. Those two environments have opposite safety
// defaults: the demo WANTS the conveniences (seeded accounts, one-click
// login) that would be indefensible anywhere real patient data exists.
//
// DEPLOYMENT_MODE therefore gates the demo-only switches so that flipping a
// demo flag cannot silently carry into an on-prem install. This is a
// fail-closed guard, not a warning: the dangerous combination is refused at
// startup rather than logged and ignored.

const VALID_MODES = ['demo', 'onprem'];

/** Modes where DEMO_QUICK_LOGIN and SEED_DEMO_DATA may be enabled. */
const DEMO_CAPABLE_MODES = ['demo'];

function normalizeMode(value) {
  // Unset means on-prem. That is the safe default: a fresh install that never
  // set DEPLOYMENT_MODE must not come up with demo conveniences available.
  if (value === undefined || value === null || value === '') return 'onprem';

  const mode = String(value).trim().toLowerCase();
  if (!VALID_MODES.includes(mode)) {
    throw new Error(
      `DEPLOYMENT_MODE must be one of ${VALID_MODES.join(', ')}; got "${value}".\n` +
        'Use "demo" for a public demo deployment and "onprem" for a hospital install.'
    );
  }
  return mode;
}

/** True when demo conveniences are permitted in this deployment. */
export function isDemoMode(env = process.env) {
  return DEMO_CAPABLE_MODES.includes(normalizeMode(env.DEPLOYMENT_MODE));
}

/**
 * Reads a boolean env var.
 *
 * Deliberately strict: only the exact string "true" enables a flag. Anything
 * else -- including "1", "yes", or a typo -- reads as false. A flag that opens
 * unauthenticated admin access should not be turnable on by accident.
 */
export function envFlag(name, env = process.env) {
  return env[name] === 'true';
}

/**
 * Refuses the demo flags outside the demo profile.
 *
 * Called once at startup so an on-prem install physically cannot come up with
 * DEMO_QUICK_LOGIN or SEED_DEMO_DATA active, however they got set. Refuses
 * loudly and names the offending variable, because "my admin password is the
 * username" is a bad afternoon to debug from a support ticket.
 */
export function assertDemoFlagsAllowed(env = process.env) {
  if (isDemoMode(env)) return;

  const violations = [];
  if (envFlag('DEMO_QUICK_LOGIN', env)) violations.push('DEMO_QUICK_LOGIN');
  if (envFlag('SEED_DEMO_DATA', env)) violations.push('SEED_DEMO_DATA');

  if (violations.length > 0) {
    throw new Error(
      `Refusing to start: ${violations.join(' and ')} ${violations.length === 1 ? 'is' : 'are'} enabled ` +
        `but DEPLOYMENT_MODE is "${normalizeMode(env.DEPLOYMENT_MODE)}".\n\n` +
        'DEMO_QUICK_LOGIN hands a logged-in session to anyone who can reach the URL, with no password, ' +
        'for every demo role including SuperAdmin. SEED_DEMO_DATA creates those accounts with predictable ' +
        'credentials. Neither is acceptable anywhere real patient data exists.\n\n' +
        `Fix: set ${violations.join(' and ')} to false, or remove ${violations.length === 1 ? 'it' : 'them'}. ` +
        'For a public demo, set DEPLOYMENT_MODE=demo instead.'
    );
  }
}