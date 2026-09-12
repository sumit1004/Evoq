import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { AppError } from '../errors/AppError.js';
import { config } from '../config/env.js';

const evidenceDirectory = path.resolve(config.uploadDirectory, 'payment-evidence');
fs.mkdirSync(evidenceDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, evidenceDirectory),
  filename: (_req, _file, callback) => callback(null, `${Date.now()}-${randomUUID()}`),
});

export function uploadPaymentEvidence(req, res, next) {
  return paymentEvidenceUpload.single('paymentScreenshot')(req, res, (error) => {
    if (!error) return validateStoredImage(req, next);
    return next(new AppError(error.message, { status: 400, code: 'UPLOAD_VALIDATION_ERROR' }));
  });
}

const resultMediaDirectory = path.resolve(config.uploadDirectory, 'match-results');
fs.mkdirSync(resultMediaDirectory, { recursive: true });
const resultMediaStorage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, resultMediaDirectory),
  filename: (_req, _file, callback) => callback(null, `${Date.now()}-${randomUUID()}`),
});

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function validateFileFilter(file, callback, label = 'image') {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIMES.has(file.mimetype)) {
    return callback(new Error(`Only PNG, JPEG, and WEBP ${label}s are allowed`));
  }
  return callback(null, true);
}

async function hasAllowedImageSignature(file) {
  try {
    const buffer = Buffer.alloc(16);
    const fd = await fsPromises.open(file.path, 'r');
    const { bytesRead } = await fd.read(buffer, 0, 16, 0);
    await fd.close();

    if (bytesRead < 8) return false;

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const isPng = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
    // JPEG signature: FF D8 FF
    const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    // WEBP signature: 'RIFF' .... 'WEBP'
    const isWebp = bytesRead >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';

    return isPng || isJpeg || isWebp;
  } catch {
    return false;
  }
}

function validateStoredImage(req, next) {
  if (!req.file) return next();
  return hasAllowedImageSignature(req.file).then((valid) => {
    if (valid) return next();
    return fsPromises.unlink(req.file.path).catch(() => {}).then(() => {
      next(new AppError('The uploaded file is not a valid supported image', { status: 400, code: 'UPLOAD_VALIDATION_ERROR' }));
    });
  }).catch(() => fsPromises.unlink(req.file.path).catch(() => {}).then(() => {
    next(new AppError('The uploaded file could not be validated', { status: 400, code: 'UPLOAD_VALIDATION_ERROR' }));
  }));
}

export const resultMediaUpload = multer({
  storage: resultMediaStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => validateFileFilter(file, callback, 'result media'),
});

export function uploadResultMedia(req, res, next) {
  return resultMediaUpload.single('resultMedia')(req, res, (error) => {
    if (!error) return validateStoredImage(req, next);
    return next(new AppError(error.message, { status: 400, code: 'UPLOAD_VALIDATION_ERROR' }));
  });
}

export const paymentEvidenceUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => validateFileFilter(file, callback, 'payment screenshot'),
});

const qrDirectory = path.resolve(config.uploadDirectory, 'payment-qrs');
if (!fs.existsSync(qrDirectory)) {
  fs.mkdirSync(qrDirectory, { recursive: true });
}
const qrStorage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, qrDirectory),
  filename: (_req, _file, callback) => callback(null, `${Date.now()}-${randomUUID()}`),
});
export const qrUpload = multer({
  storage: qrStorage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => validateFileFilter(file, callback, 'payment QR'),
});
export function uploadPaymentQr(req, res, next) {
  return qrUpload.single('paymentQr')(req, res, (error) => {
    if (!error) return validateStoredImage(req, next);
    return next(new AppError(error.message, { status: 400, code: 'UPLOAD_VALIDATION_ERROR' }));
  });
}

// Reusable temporary upload storage for MediaService targets
const tempMediaDirectory = path.resolve(config.uploadDirectory, 'temp');
if (!fs.existsSync(tempMediaDirectory)) {
  fs.mkdirSync(tempMediaDirectory, { recursive: true });
}

const tempStorage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, tempMediaDirectory),
  filename: (_req, _file, callback) => callback(null, `temp-${Date.now()}-${randomUUID()}`),
});

const teamLogoMulter = multer({
  storage: tempStorage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => validateFileFilter(file, callback, 'team logo'),
});

export function uploadTeamLogo(req, res, next) {
  return teamLogoMulter.single('logo')(req, res, (error) => {
    if (!error) return validateStoredImage(req, next);
    return next(new AppError(error.message, { status: 400, code: 'UPLOAD_VALIDATION_ERROR' }));
  });
}

const orgLogoMulter = multer({
  storage: tempStorage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => validateFileFilter(file, callback, 'organization logo'),
});

export function uploadOrgLogo(req, res, next) {
  return orgLogoMulter.single('logo')(req, res, (error) => {
    if (!error) return validateStoredImage(req, next);
    return next(new AppError(error.message, { status: 400, code: 'UPLOAD_VALIDATION_ERROR' }));
  });
}

const orgBannerMulter = multer({
  storage: tempStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => validateFileFilter(file, callback, 'cover banner'),
});

export function uploadOrgBanner(req, res, next) {
  return orgBannerMulter.single('banner')(req, res, (error) => {
    if (!error) return validateStoredImage(req, next);
    return next(new AppError(error.message, { status: 400, code: 'UPLOAD_VALIDATION_ERROR' }));
  });
}


