import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export function errorHandler(error, req, res, _next) {
  const status = Number.isInteger(error.status) ? error.status : 500;

  logger.error('request_failed', {
    method: req.method,
    path: req.originalUrl,
    status,
    message: error.message,
  });

  res.status(status).json({
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: status >= 500 ? 'Unexpected server error' : error.message,
      ...(config.nodeEnv === 'development' && status >= 500 ? { detail: error.message } : {}),
    },
  });
}
