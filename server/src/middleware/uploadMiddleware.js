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

async function hasAllowedImageSignature(file) {
  const header = await fsPromises.readFile(file.path);
  if (file.mimetype === 'image/png') return header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (file.mimetype === 'image/jpeg') return header.length >= 3 && header.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  if (file.mimetype === 'image/webp') return header.length >= 12 && header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
  return false;
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
  fileFilter: (_req, file, callback) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) return callback(new Error('Only PNG, JPEG, and WEBP result media are allowed'));
    return callback(null, true);
  },
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
  fileFilter: (_req, file, callback) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) return callback(new Error('Only PNG, JPEG, and WEBP payment screenshots are allowed'));
    return callback(null, true);
  },
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
  fileFilter: (_req, file, callback) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) return callback(new Error('Only PNG, JPEG, and WEBP images are allowed'));
    return callback(null, true);
  },
});
export function uploadPaymentQr(req, res, next) {
  return qrUpload.single('paymentQr')(req, res, (error) => {
    if (!error) return validateStoredImage(req, next);
    return next(new AppError(error.message, { status: 400, code: 'UPLOAD_VALIDATION_ERROR' }));
  });
}

