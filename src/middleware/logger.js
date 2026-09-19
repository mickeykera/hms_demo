export function requestLogger(req, res, next) {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(2, 10);

  req.requestId = requestId;

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