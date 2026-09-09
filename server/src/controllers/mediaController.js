import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/env.js';
import { errorResponses } from '../errors/AppError.js';

export function serveMediaFile(req, res, next) {
  const relativePath = req.params[0];
  if (!relativePath) {
    return next(errorResponses.notFound('Media file not found'));
  }

  // Prevent path traversal
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.resolve(config.uploadDirectory, normalized);

  if (!filePath.startsWith(path.resolve(config.uploadDirectory))) {
    return next(errorResponses.forbidden('Access denied'));
  }

  if (!fs.existsSync(filePath)) {
    return next(errorResponses.notFound('Media file not found'));
  }

  // Cache headers for immutable media
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') res.setHeader('Content-Type', 'image/png');
  else if (ext === '.jpg' || ext === '.jpeg') res.setHeader('Content-Type', 'image/jpeg');
  else if (ext === '.webp') res.setHeader('Content-Type', 'image/webp');

  return res.sendFile(filePath);
}
