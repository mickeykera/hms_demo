export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, details) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT');
  }
}

export function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${new Date().toISOString()} - ${req.method} ${req.path}`, {
    message: err.message,
    code: err.code || 'UNKNOWN',
    statusCode: err.statusCode || 500,
    stack: err.stack,
    user: req.user ? { id: req.user.id, role: req.user.role } : null,
  });

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
    });
  }

  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.flatten().fieldErrors,
    });
  }

  // node:sqlite does not set code === 'SQLITE_CONSTRAINT'. It reports a generic
  // 'ERR_SQLITE_ERROR' plus numeric errcode (SQLITE_CONSTRAINT is 2067) and an
  // errstr of 'constraint failed', so the informative signal is in the message.
  // Matching on the old code alone meant every constraint violation escaped as
  // a bare 500.
  if (err.code === 'ERR_SQLITE_ERROR' || err.code === 'SQLITE_CONSTRAINT' || err.errcode === 2067) {
    const message = err.message || '';
    if (message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        error: 'Duplicate entry',
        code: 'DUPLICATE_ENTRY',
      });
    }
    if (message.includes('FOREIGN KEY constraint failed')) {
      return res.status(400).json({
        error: 'Referenced resource does not exist',
        code: 'FOREIGN_KEY_VIOLATION',
      });
    }
    if (message.includes('NOT NULL constraint failed') || message.includes('CHECK constraint failed')) {
      return res.status(400).json({
        error: 'Request violates a database constraint',
        code: 'CONSTRAINT_VIOLATION',
      });
    }
  }

  if (err.code === 'SQLITE_CONSTRAINT' || err.errstr === 'constraint failed') {
    // A constraint error we did not classify above.
    return res.status(400).json({
      error: 'Request violates a database constraint',
      code: 'CONSTRAINT_VIOLATION',
    });
  }

  return res.status(500).json({
    error: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
  });
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: `Route ${req.method} ${req.path} not found`,
    code: 'ROUTE_NOT_FOUND',
  });
}