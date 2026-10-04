// If the proxy chain ever changes shape, req.ip silently stops being the
// browser and becomes an internal or shared proxy address instead. Nothing
// throws: every visitor just collapses into one rate-limit bucket and the
// audit trail records the wrong party. `trust proxy = 3` is what keeps that
// from happening, so this watches the resolved address and turns silent drift
// into a visible warning.
//
// Diagnostic only, and OFF by default.
//
// This is a debugging aid for the public demo, where the proxy chain lives
// outside our control and can change without notice (Render or Cloudflare
// alters its topology, and req.ip quietly stops being the browser). It is
// useless on a hospital LAN: there the proxy is one fixed local address we
// configure ourselves, so a private req.ip is the expected steady state and
// warning about it on every boot would just train staff to ignore the log.
//
// Enable with PROXY_IP_WARN=true on deployments where the chain is not ours
// to control. render.yaml sets it.
function isProxyIpWarningEnabled() {
  return process.env.PROXY_IP_WARN === 'true';
}

// Once per interval, because the failure mode is by definition widespread:
// warning per request would flood the log exactly when the problem is worst.
const PRIVATE_IP_WARN_INTERVAL_MS = 5 * 60 * 1000;
let lastPrivateIpWarnAt = 0;

/**
 * True for loopback, RFC1918, link-local, CGNAT and reserved IPv4, plus the
 * equivalent IPv6 ranges (loopback, unique-local, link-local). IPv4-mapped
 * IPv6 is unwrapped first, since Node reports localhost as ::ffff:127.0.0.1.
 *
 * Returns false for anything that is not a parseable IP -- an unparseable
 * address is a different problem and should not trip this guard.
 */
export function isPrivateOrReservedIp(ip) {
  if (!ip || typeof ip !== 'string') return false;

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 0) return true; // 0.0.0.0/8 "this network"
    if (a === 10) return true; // 10/8 private
    if (a === 127) return true; // 127/8 loopback
    if (a === 169 && b === 254) return true; // 169.254/16 link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12 private
    if (a === 192 && b === 168) return true; // 192.168/16 private
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
    if (a >= 224) return true; // multicast + 240/4 reserved
    return false;
  }

  const lower = ip.toLowerCase().split('%')[0]; // drop any zone id
  if (lower.includes(':')) {
    if (lower === '::1' || lower === '::') return true; // loopback / unspecified
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(lower);
    if (mapped) return isPrivateOrReservedIp(mapped[1]);
    if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true; // fc00::/7 unique-local
    if (/^fe[89ab][0-9a-f]:/.test(lower)) return true; // fe80::/10 link-local
    return false;
  }

  return false;
}

function warnOnPrivateIp(ip, requestId) {
  if (!isProxyIpWarningEnabled()) return;
  if (!isPrivateOrReservedIp(ip)) return;

  const now = Date.now();
  // A clock that moved backwards leaves a negative delta, which correctly
  // skips the warning rather than spamming one.
  if (now - lastPrivateIpWarnAt < PRIVATE_IP_WARN_INTERVAL_MS) return;
  lastPrivateIpWarnAt = now;

  console.warn(
    `[PROXY-IP] ${new Date().toISOString()} - resolved req.ip ${ip} is private or reserved, not a real client`,
    {
      requestId,
      ip,
      hint: 'Proxy chain shape likely changed. Check "trust proxy" against the real hop count; if req.ip is a proxy or shared edge IP, all visitors share one rate-limit bucket.',
    },
  );
}

export function requestLogger(req, res, next) {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(2, 10);

  req.requestId = requestId;

  const ip = req.ip || req.connection.remoteAddress;

  console.log(`[REQUEST] ${new Date().toISOString()} - ${req.method} ${req.path}`, {
    requestId,
    ip,
    userAgent: req.get('user-agent'),
    user: req.user ? { id: req.user.id, role: req.user.role } : null,
    query: sanitizeBody(req.query),
    body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined,
  });

  warnOnPrivateIp(ip, requestId);

  const originalSend = res.send;
  res.send = function (body) {
    const duration = Date.now() - start;
    console.log(`[RESPONSE] ${new Date().toISOString()} - ${req.method} ${req.path}`, {
      requestId,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
    return originalSend.call(this, body);
  };

  next();
}

// Credential redaction.
//
// Substring matching on a normalised key, rather than an exact-name list,
// because a codebase mixes casing freely: password / Password / password_hash,
// api_key / apiKey / api-key / API_KEY all mean the same thing. An exact list
// silently misses every variant it did not enumerate -- which is how a
// camelCase secret ends up in a log file for the life of the install.
//
// Keys are normalised by lowercasing and dropping "_" and "-", so all of the
// above collapse to "password" / "apikey" and match.
const SENSITIVE_KEY_SUBSTRINGS = [
  'password',
  'token',
  'secret',
  'apikey',
  'authorization',
  'credential',
];

const REDACTED = '[REDACTED]';
const TRUNCATED = '[TRUNCATED]';

// Bounds the walk so a pathologically nested body cannot stall a request or
// blow the stack.
//
// At the cap the subtree is REPLACED rather than passed through. Returning the
// deep value verbatim would mean anything past the cap leaks again, which
// defeats the point -- so beyond the cap the content is dropped. Real request
// bodies are rarely deeper than this, and losing the tail of an absurd one is a
// fair price for a guarantee that holds at any depth.
const MAX_DEPTH = 6;

function isSensitiveKey(key) {
  const normalised = String(key).toLowerCase().replace(/[_-]/g, '');
  return SENSITIVE_KEY_SUBSTRINGS.some((needle) => normalised.includes(needle));
}

// Only plain objects and arrays are walked. A Date, Buffer, or a class instance
// would otherwise be rebuilt as a bare {} and lose its behaviour in the log.
function isWalkable(value) {
  if (Array.isArray(value)) return true;
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Returns a redacted COPY of `body`. The original is never mutated: the route
 * handler still has to read the real values, and sanitising in place would hand
 * it [REDACTED] instead.
 */
/**
 * Redacts credentials embedded in a URL's query string, preserving the rest.
 *
 * req.originalUrl and friends carry the whole query string inline, so a
 * `?token=...` leaks even from code that never touches req.query. A URL cannot
 * be run through sanitizeBody because it is a string, so the query is split
 * out, filtered, and reassembled -- keeping the non-sensitive parameters, which
 * are the reason the URL is being recorded at all.
 *
 * The path itself is NOT filtered. Path segments are opaque here: the request
 * logger runs before route matching, so it cannot know that
 * `/download/:token` is sensitive while `/patients/:id` is not. Guessing from
 * value shape would redact legitimate identifiers. Passing a credential as a
 * path segment is therefore a residual risk, documented rather than papered
 * over -- callers must not accept secrets that way.
 */
export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return url;

  const qIndex = url.indexOf('?');
  if (qIndex === -1) return url;

  const base = url.slice(0, qIndex);
  const search = url.slice(qIndex + 1);
  if (!search) return url;

  let params;
  try {
    params = new URLSearchParams(search);
  } catch {
    // Not parseable: refuse to guess. Dropping the query is safer than echoing
    // it, and a malformed query string is not worth preserving.
    return base;
  }

  let changed = false;
  for (const key of [...params.keys()]) {
    if (isSensitiveKey(key)) {
      params.set(key, REDACTED);
      changed = true;
    }
  }

  if (!changed) return url;
  // URLSearchParams percent-encodes the brackets in [REDACTED]. These strings
  // are read by humans, so put them back rather than making every reviewer
  // decode %5B by eye.
  return `${base}?${params.toString()}`
    .replace(/%5B/g, '[')
    .replace(/%5D/g, ']');
}

export function sanitizeBody(body, depth = 0) {
  if (!body || typeof body !== 'object') return body;
  if (!isWalkable(body)) return body;
  if (depth >= MAX_DEPTH) return Array.isArray(body) ? [TRUNCATED] : TRUNCATED;

  if (Array.isArray(body)) {
    return body.map((item) => sanitizeBody(item, depth + 1));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(body)) {
    // A sensitive key is redacted wholesale, including when its value is an
    // object: { credentials: { password } } needs no further inspection.
    sanitized[key] = isSensitiveKey(key) ? REDACTED : sanitizeBody(value, depth + 1);
  }
  return sanitized;
}

export function auditLogger(action, details) {
  console.log(`[AUDIT] ${new Date().toISOString()} - ${action}`, details);
}