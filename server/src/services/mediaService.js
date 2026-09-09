import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config/env.js';
import { AppError, errorResponses } from '../errors/AppError.js';

const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export async function hasAllowedImageSignature(bufferOrPath, mimetype) {
  let header;
  if (typeof bufferOrPath === 'string') {
    try {
      header = await fsPromises.readFile(bufferOrPath);
    } catch {
      return false;
    }
  } else if (Buffer.isBuffer(bufferOrPath)) {
    header = bufferOrPath;
  } else {
    return false;
  }

  if (mimetype === 'image/png') {
    return header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') {
    return header.length >= 3 && header.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  }
  if (mimetype === 'image/webp') {
    return header.length >= 12 && header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

export function generateMediaKey({ category, entityId, type = 'media', ext = 'webp' }) {
  const safeExt = ext.replace(/^\./, '').toLowerCase();
  const safeCategory = String(category || 'general').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeEntityId = String(entityId || '0').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeType = String(type || 'item').replace(/[^a-zA-Z0-9_-]/g, '');
  const uniqueId = randomUUID();

  return `${safeCategory}/${safeEntityId}/${safeType}/${uniqueId}.${safeExt}`;
}

export function getPublicMediaUrl(storageKey) {
  if (!storageKey) return null;
  if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) {
    return storageKey;
  }
  const cleanKey = storageKey.replace(/^\/+/, '');
  return `/api/media/${cleanKey}`;
}

export async function saveMediaObject({ file, category, entityId, type }) {
  if (!file) {
    throw errorResponses.validation({ file: 'File is required' });
  }

  if (!ALLOWED_MIMES.has(file.mimetype)) {
    throw new AppError('Only PNG, JPEG, and WEBP image files are allowed', {
      status: 400,
      code: 'UPLOAD_VALIDATION_ERROR',
    });
  }

  const isValid = await hasAllowedImageSignature(file.path, file.mimetype);
  if (!isValid) {
    await fsPromises.unlink(file.path).catch(() => {});
    throw new AppError('The uploaded file does not have a valid image binary signature', {
      status: 400,
      code: 'UPLOAD_VALIDATION_ERROR',
    });
  }

  const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
  const objectKey = generateMediaKey({ category, entityId, type, ext });
  const targetPath = path.resolve(config.uploadDirectory, objectKey);
  const targetDir = path.dirname(targetPath);

  await fsPromises.mkdir(targetDir, { recursive: true });
  await fsPromises.copyFile(file.path, targetPath);
  await fsPromises.unlink(file.path).catch(() => {});

  return {
    objectKey,
    url: getPublicMediaUrl(objectKey),
    mimetype: file.mimetype,
    size: file.size,
  };
}

export async function deleteMediaObject(storageKeyOrUrl) {
  if (!storageKeyOrUrl) return false;

  let objectKey = storageKeyOrUrl;
  if (objectKey.startsWith('/api/media/')) {
    objectKey = objectKey.replace('/api/media/', '');
  }

  // Prevent path traversal
  const normalizedKey = path.normalize(objectKey).replace(/^(\.\.(\/|\\|$))+/, '');
  const targetPath = path.resolve(config.uploadDirectory, normalizedKey);

  // Safety check: ensure file is inside uploadDirectory
  if (!targetPath.startsWith(path.resolve(config.uploadDirectory))) {
    return false;
  }

  try {
    await fsPromises.unlink(targetPath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    return false;
  }
}

export async function replaceMediaObject({ oldKeyOrUrl, newFile, category, entityId, type }) {
  const newMedia = await saveMediaObject({ file: newFile, category, entityId, type });

  if (oldKeyOrUrl && oldKeyOrUrl !== newMedia.url && oldKeyOrUrl !== newMedia.objectKey) {
    await deleteMediaObject(oldKeyOrUrl).catch(() => {});
  }

  return newMedia;
}
