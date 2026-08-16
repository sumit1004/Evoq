import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

const requiredInProduction = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_NAME', 'CLIENT_ORIGIN'];

function getNumber(name, fallback) {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number`);
  }

  return parsed;
}

function assertProductionEnv() {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const missing = requiredInProduction.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

assertProductionEnv();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: getNumber('PORT', 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'development-only-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  uploadDirectory: path.resolve(process.env.UPLOAD_DIRECTORY || 'uploads'),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: getNumber('DB_PORT', 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'evoq',
    connectionLimit: getNumber('DB_CONNECTION_LIMIT', 10),
  },
};
