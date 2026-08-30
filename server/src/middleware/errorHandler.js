import { config } from '../config/env.js';
import { isDatabaseError } from '../config/database.js';
import { logger } from '../utils/logger.js';

export function errorHandler(error, req, res, _next) {
  // Map SQL constraint / duplicate key violations to 409 Conflict instead of 503 database failure
  if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
    return res.status(409).json({
      error: {
        code: 'FOREIGN_KEY_CONFLICT',
        message: 'Cannot modify or delete this item because related records depend on it.',
      },
    });
  }

  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'A conflicting record already exists.',
      },
    });
  }

  const databaseFailure = isDatabaseError(error);
  const status = Number.isInteger(error.status) ? error.status : databaseFailure ? 503 : 500;
  const code = databaseFailure ? 'DATABASE_UNAVAILABLE' : error.code || 'INTERNAL_ERROR';

  logger.error('request_failed', {
    method: req.method,
    path: req.originalUrl,
    status,
    errorCode: code,
    message: error.message,
    sqlCode: error.code,
    sqlMessage: error.sqlMessage,
    stack: error.stack,
  });

  res.status(status).json({
    error: {
      code,
      message: databaseFailure
        ? 'The EVOQ database is unavailable. Please try again later.'
        : status >= 500
          ? 'Unexpected server error'
          : error.message,
      ...(error.details ? { details: error.details } : {}),
      ...(config.nodeEnv === 'development' && status >= 500 && !databaseFailure
        ? { detail: error.message }
        : {}),
    },
  });
}

