import { describe, expect, it } from 'vitest';
import { DATABASE_ERROR_CODES, isDatabaseError, pingDatabase } from './database.js';

describe('database utility and error classification', () => {
  it('correctly identifies database errors by code', () => {
    expect(isDatabaseError({ code: 'ECONNREFUSED' })).toBe(true);
    expect(isDatabaseError({ code: 'PROTOCOL_CONNECTION_LOST' })).toBe(true);
    expect(isDatabaseError({ code: 'ETIMEDOUT' })).toBe(true);
    expect(isDatabaseError({ code: 'ER_ACCESS_DENIED_ERROR' })).toBe(true);
    expect(isDatabaseError({ code: 'ER_NO_SUCH_TABLE' })).toBe(true);
    expect(isDatabaseError({ syscall: 'connect' })).toBe(true);
    expect(isDatabaseError({ fatal: true })).toBe(true);
    expect(isDatabaseError({ message: 'connect ECONNREFUSED 127.0.0.1:3306' })).toBe(true);
  });

  it('correctly ignores non-database errors', () => {
    expect(isDatabaseError(null)).toBe(false);
    expect(isDatabaseError(undefined)).toBe(false);
    expect(isDatabaseError({ code: 'VALIDATION_ERROR' })).toBe(false);
    expect(isDatabaseError(new Error('Normal application error'))).toBe(false);
  });

  it('contains expected error codes in DATABASE_ERROR_CODES set', () => {
    expect(DATABASE_ERROR_CODES.has('ECONNREFUSED')).toBe(true);
    expect(DATABASE_ERROR_CODES.has('PROTOCOL_CONNECTION_LOST')).toBe(true);
    expect(DATABASE_ERROR_CODES.has('ETIMEDOUT')).toBe(true);
  });

  it('pingDatabase returns a structured object without throwing', async () => {
    const result = await pingDatabase(500);
    expect(typeof result).toBe('object');
    expect(typeof result.ok).toBe('boolean');
  });
});
