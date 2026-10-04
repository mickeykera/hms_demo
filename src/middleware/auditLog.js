import { getDb, createAuditLog } from '../models/index.js';
import { sanitizeBody, sanitizeUrl } from './logger.js';

// All three sinks below serialise parts of the request into audit_logs.details,
// a database row that outlives the request and is readable by anyone with audit
// access. Two distinct leaks are closed here:
//
//   - the BODY goes through sanitizeBody, so a password anywhere in it is
//     redacted. auditMiddleware previously stored it raw.
//   - the URL and QUERY go through sanitizeUrl/sanitizeBody. originalUrl embeds
//     the entire query string inline, so a ?token= would be recorded even by
//     code that never reads req.query.
//
// Without redaction a password sent to an audited route would be persisted in
// cleartext for the life of the install.

export function auditLog(action, resourceType, resourceId = null, details = null) {
  return (req, res, next) => {
    const originalSend = res.send;

    res.send = function(data) {
      if (res.statusCode < 400 && req.user) {
        try {
          createAuditLog({
            actor_id: req.user.id,
            action,
            resource_type: resourceType,
            resource_id: resourceId,
            details: details || (req.body ? JSON.stringify(sanitizeBody(req.body)) : null),
            ip_address: req.ip || req.connection?.remoteAddress,
          });
        } catch (e) {
          console.error('Audit log error:', e);
        }
      }
      return originalSend.call(this, data);
    };
    next();
  };
}

export function logResourceAction(action, resourceType) {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode < 400 && req.user) {
        try {
          const resourceId = req.params.id || req.body?.id || req.body?.resource_id || null;
          createAuditLog({
            actor_id: req.user.id,
            action,
            resource_type: resourceType,
            resource_id: resourceId,
            details: req.body ? JSON.stringify(sanitizeBody(req.body)) : null,
            ip_address: req.ip || req.connection?.remoteAddress,
          });
        } catch (e) {
          console.error('Audit log error:', e);
        }
      }
    });
    next();
  };
}

export function createDetailedAuditLog(req, action, resourceType, resourceId, beforeState, afterState, details = null) {
  if (!req.user) return;
  
  try {
    const db = getDb();
    const auditDetails = {
      ...sanitizeBody(details || {}),
      before: sanitizeBody(beforeState),
      after: sanitizeBody(afterState),
      method: req.method,
      url: sanitizeUrl(req.originalUrl),
      userAgent: req.get('User-Agent'),
    };
    
    createAuditLog({
      actor_id: req.user.id,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details: JSON.stringify(auditDetails),
      ip_address: req.ip || req.connection?.remoteAddress,
    });
  } catch (e) {
    console.error('Detailed audit log error:', e);
  }
}

export function auditMiddleware() {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      if (req.user && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        try {
          let action = req.method;
          if (req.method === 'POST') action = 'CREATE';
          else if (req.method === 'PUT' || req.method === 'PATCH') action = 'UPDATE';
          else if (req.method === 'DELETE') action = 'DELETE';
          
          const resourceType = req.baseUrl.split('/').pop() || 'unknown';
          const resourceId = req.params.id || req.body?.id || null;
          
          createAuditLog({
            actor_id: req.user.id,
            action,
            resource_type: resourceType,
            resource_id: resourceId,
            details: JSON.stringify({
              method: req.method,
              url: sanitizeUrl(req.originalUrl),
              body: sanitizeBody(req.body),
              query: sanitizeBody(req.query),
            }),
            ip_address: req.ip || req.connection?.remoteAddress,
          });
        } catch (e) {
          console.error('Audit middleware error:', e);
        }
      }
      return originalSend.call(this, data);
    };
    next();
  };
}
