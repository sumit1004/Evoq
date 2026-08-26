import mysql from 'mysql2/promise';
import { config } from './env.js';

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  maxIdle: config.db.connectionLimit,
  idleTimeout: 60_000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: config.db.connectTimeout,
  namedPlaceholders: true,
});

export const DATABASE_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'PROTOCOL_CONNECTION_LOST',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'PROTOCOL_ENQUEUE_AFTER_FATAL',
  'PROTOCOL_PACKETS_OUT_OF_ORDER',
  'ER_ACCESS_DENIED_ERROR',
  'ER_DBACCESS_DENIED_ERROR',
  'ER_CON_COUNT_ERROR',
  'ER_BAD_DB_ERROR',
  'ER_HOST_NOT_PRIVILEGED',
  'ER_HOST_IS_BLOCKED',
  'ER_GET_CONNECTION_TIMEOUT',
]);

export function isDatabaseError(error) {
  if (!error) return false;
  if (typeof error.code === 'string') {
    if (DATABASE_ERROR_CODES.has(error.code) || error.code.startsWith('ER_')) {
      return true;
    }
  }
  if (error.syscall === 'connect' || error.fatal) {
    return true;
  }
  const message = error.message || '';
  if (
    message.includes('ECONNREFUSED') ||
    message.includes('Connection lost') ||
    message.includes('closed state') ||
    message.includes('getaddrinfo')
  ) {
    return true;
  }
  return false;
}

export async function pingDatabase(timeoutMs = 5000) {
  let timer;
  try {
    const queryPromise = pool.query('SELECT 1 AS ok');
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const err = new Error('Database ping timed out');
        err.code = 'ETIMEDOUT';
        reject(err);
      }, timeoutMs);
    });

    const [rows] = await Promise.race([queryPromise, timeoutPromise]);
    clearTimeout(timer);
    return { ok: rows?.[0]?.ok === 1 };
  } catch (error) {
    clearTimeout(timer);
    return { ok: false, error: error?.message || 'Database unavailable' };
  }
}

