import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/env.js';
import { errorResponses } from '../errors/AppError.js';

const PUBLIC_CATEGORIES = new Set(['teams', 'organizations', 'payment-qrs', 'general', 'avatars', 'match-results']);

export function serveMediaFile(req, res, next) {
  const relativePath = req.params[0];
  if (!relativePath) {
    return next(errorResponses.notFound('Media file not found'));
  }

  // Prevent path traversal and null bytes
  if (relativePath.includes('\0') || relativePath.includes('..')) {
    return next(errorResponses.forbidden('Access denied'));
  }

  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const uploadRoot = path.resolve(config.uploadDirectory);
  const filePath = path.resolve(uploadRoot, normalized);

  if (!filePath.startsWith(uploadRoot)) {
    return next(errorResponses.forbidden('Access denied'));
  }

  // Explicitly disallow payment evidence and temp directories from public media endpoint
  const relativeFromRoot = path.relative(uploadRoot, filePath);
  const topDirectory = relativeFromRoot.split(path.sep)[0];

  if (!PUBLIC_CATEGORIES.has(topDirectory)) {
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
