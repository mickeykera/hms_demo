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
  const { status, body } = classify(err);

  // Log level follows the status we are actually sending. A 5xx is our fault and
  // needs the stack to debug; a 4xx is a client mistake, and logging those at
  // error severity buries real failures under expected conditions like a
  // duplicate insert or a missing patient. The stack is dropped from 4xx because
  // it exposes file paths and internals for input the caller already controls.
  const level = status >= 500 ? 'ERROR' : 'WARN';
  const context = {
    message: err.message,
    code: err.code || 'UNKNOWN',
    statusCode: status,
    user: req.user ? { id: req.user.id, role: req.user.role } : null,
  };
  const line = `[${level}] ${new Date().toISOString()} - ${req.method} ${req.path}`;

  if (status >= 500) {
    console.error(line, { ...context, stack: err.stack });
  } else {
    console.warn(line, context);
  }

  return res.status(status).json(body);
}

// Maps an error onto the status/body pair sent to the client. Kept separate from
// the logging so the two can never drift apart.
function classify(err) {
  if (err instanceof AppError) {
    return {
      status: err.statusCode,
      body: {
        error: err.message,
        code: err.code,
        details: err.details,
      },
    };
  }

  if (err.name === 'ZodError') {
    return {
      status: 400,
      body: {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: err.flatten().fieldErrors,
      },
    };
  }

  // node:sqlite does not set code === 'SQLITE_CONSTRAINT'. It reports a generic
  // 'ERR_SQLITE_ERROR' plus numeric errcode (SQLITE_CONSTRAINT is 2067) and an
  // errstr of 'constraint failed', so the informative signal is in the message.
  // Matching on the old code alone meant every constraint violation escaped as
  // a bare 500.
  if (err.code === 'ERR_SQLITE_ERROR' || err.code === 'SQLITE_CONSTRAINT' || err.errcode === 2067) {
    const message = err.message || '';
    if (message.includes('UNIQUE constraint failed')) {
      return { status: 409, body: { error: 'Duplicate entry', code: 'DUPLICATE_ENTRY' } };
    }
    if (message.includes('FOREIGN KEY constraint failed')) {
      return {
        status: 400,
        body: { error: 'Referenced resource does not exist', code: 'FOREIGN_KEY_VIOLATION' },
      };
    }
    if (message.includes('NOT NULL constraint failed') || message.includes('CHECK constraint failed')) {
      return {
        status: 400,
        body: { error: 'Request violates a database constraint', code: 'CONSTRAINT_VIOLATION' },
      };
    }
  }

  if (err.code === 'SQLITE_CONSTRAINT' || err.errstr === 'constraint failed') {
    // A constraint error we did not classify above.
    return {
      status: 400,
      body: { error: 'Request violates a database constraint', code: 'CONSTRAINT_VIOLATION' },
    };
  }

  return {
    status: 500,
    body: { error: 'Internal Server Error', code: 'INTERNAL_ERROR' },
  };
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