import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { errorResponses } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

function getBearerToken(header) {
  if (typeof header !== 'string') {
    return null;
  }

  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

export function authenticateRequest(req, _res, next) {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    logger.error('authentication_failed', { method: req.method, path: req.originalUrl, reason: 'missing_token' });
    return next(errorResponses.authenticationRequired());
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0 || !['PLAYER', 'ORGANIZER', 'ADMIN'].includes(payload.role)) {
      return next(errorResponses.invalidToken());
    }

    req.user = {
      id: userId,
      role: payload.role,
    };
    return next();
  } catch {
    logger.error('authentication_failed', { method: req.method, path: req.originalUrl, reason: 'invalid_or_expired_token' });
    return next(errorResponses.invalidToken());
  }
}

export function optionalAuthentication(req, _res, next) {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const userId = Number(payload.sub);
    if (Number.isSafeInteger(userId) && userId > 0 && ['PLAYER', 'ORGANIZER', 'ADMIN'].includes(payload.role)) {
      req.user = { id: userId, role: payload.role };
    }
  } catch {
    // Optional authentication treats an invalid token as anonymous.
  }

  return next();
}
