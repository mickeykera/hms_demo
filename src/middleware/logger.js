export function requestLogger(req, res, next) {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(2, 10);

  req.requestId = requestId;

  // === TEMPORARY DIAGNOSTIC -- REMOVE AFTER CHOOSING A trust proxy VALUE ===
  //
  // Goal: on Render, `trust proxy = 1` yields internal 10.x addresses and a
  // different value per request from the same browser. We need to see the real
  // chain before picking a hop count (or a specific trusted header).
  //
  // SAFE BY CONSTRUCTION: an explicit allow-list. req.headers is NEVER dumped
  // wholesale, because that would print Authorization and Cookie. Only the four
  // proxy/IP headers below are read, so no credential can appear here. The
  // header names are matched case-insensitively by req.get().
  const PROBE_HEADERS = ['x-forwarded-for', 'x-real-ip', 'true-client-ip', 'cf-connecting-ip'];
  const headerProbe = {};
  for (const name of PROBE_HEADERS) {
    const value = req.get(name);
    if (value !== undefined) headerProbe[name] = value;
  }
  console.log(`[PROBE ${requestId}] ${req.method} ${req.path}`, {
    headers: headerProbe,
    reqIp: req.ip,
    reqIps: req.ips,
    socketRemoteAddress: req.socket?.remoteAddress,
    trustProxySetting: req.app?.get?.('trust proxy'),
    remoteFamily: req.socket?.remoteFamily,
  });
  // === END TEMPORARY DIAGNOSTIC ===

  console.log(`[REQUEST] ${new Date().toISOString()} - ${req.method} ${req.path}`, {
    requestId,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    user: req.user ? { id: req.user.id, role: req.user.role } : null,
    query: req.query,
    body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined,
  });

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