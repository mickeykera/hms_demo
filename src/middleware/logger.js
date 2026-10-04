// If the proxy chain ever changes shape, req.ip silently stops being the
// browser and becomes an internal or shared proxy address instead. Nothing
// throws: every visitor just collapses into one rate-limit bucket and the
// audit trail records the wrong party. `trust proxy = 3` is what keeps that
// from happening, so this watches the resolved address and turns silent drift
// into a visible warning.
//
// Only warned once per interval, because the failure is by definition
// widespread -- warning per request would flood the log exactly when the
// problem is worst.
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
    query: req.query,
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

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'password_hash', 'token', 'authorization', 'secret', 'api_key'];
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  return sanitized;
}

export function auditLogger(action, details) {
  console.log(`[AUDIT] ${new Date().toISOString()} - ${action}`, details);
}