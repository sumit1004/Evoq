import { config } from '../config/env.js';
import { isDatabaseError } from '../config/database.js';
import { logger } from '../utils/logger.js';

export function errorHandler(error, req, res, _next) {
  const databaseFailure = isDatabaseError(error);
  const status = Number.isInteger(error.status) ? error.status : databaseFailure ? 503 : 500;
  const code = databaseFailure ? 'DATABASE_UNAVAILABLE' : error.code || 'INTERNAL_ERROR';

  logger.error('request_failed', {
    method: req.method,
    path: req.originalUrl,
    status,
    errorCode: code,
    message: databaseFailure ? 'EVOQ database unavailable' : error.message,
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

