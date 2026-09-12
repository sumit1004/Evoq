import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

const requiredInProduction = [
  'JWT_SECRET',
  'DB_HOST',
  'DB_USER',
  'DB_NAME',
  'CLIENT_ORIGIN',
  'APP_URL',
];

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
  host: process.env.HOST || '0.0.0.0',
  port: getNumber('PORT', 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  appUrl: process.env.APP_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'development-only-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  uploadDirectory: path.resolve(process.env.UPLOAD_DIRECTORY || 'uploads'),
  db: {
    host: process.env.TEST_DB_HOST || process.env.DB_HOST || 'localhost',
    port: getNumber('DB_PORT', 3306),
    user: process.env.TEST_DB_USER || process.env.DB_USER || 'evoq',
    password: process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.TEST_DB_NAME 
      || (process.env.NODE_ENV === 'test' ? 'evoq_test' : (process.env.DB_NAME || 'evoq')),
    connectionLimit: getNumber('DB_CONNECTION_LIMIT', 10),
    connectTimeout: getNumber('DB_CONNECT_TIMEOUT', 10000),
  },
};
