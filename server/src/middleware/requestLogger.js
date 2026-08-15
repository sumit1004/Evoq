import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger.js';

export function requestLogger(req, res, next) {
  const requestId = req.headers['x-request-id'] || randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const start = performance.now();
  res.on('finish', () => {
    logger.info('request_completed', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(performance.now() - start),
    });
  });

  next();
}
