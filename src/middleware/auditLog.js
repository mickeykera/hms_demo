import { getDb, createAuditLog } from '../models/index.js';
import { sanitizeBody } from './logger.js';

// Both audit sinks below serialise the request body into audit_logs.details,
// which is a database row that outlives the request and is readable by anyone
// with audit access. Without redaction a password sent to a logged route would
// be persisted in cleartext -- so the same sanitizer the request logger uses
// applies here. Previously the body was stored raw, which meant this column
// could hold credentials if any route was ever wired to it with one.

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
      ...details,
      before: beforeState,
      after: afterState,
      method: req.method,
      url: req.originalUrl,
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
              url: req.originalUrl,
              body: req.body,
              query: req.query,
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
