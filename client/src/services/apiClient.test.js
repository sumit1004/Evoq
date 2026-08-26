import { describe, expect, it } from 'vitest';
import { normalizeApiError } from './apiClient.js';

describe('normalizeApiError', () => {
  it('normalizes network errors when no response is received', () => {
    const error = new Error('Network Error');
    const normalized = normalizeApiError(error);

    expect(normalized.status).toBe(503);
    expect(normalized.code).toBe('SERVER_UNAVAILABLE');
    expect(normalized.message).toBe('Server is temporarily unavailable. Please check your connection and try again.');
  });

  it('normalizes 503 DATABASE_UNAVAILABLE responses', () => {
    const error = {
      response: {
        status: 503,
        data: {
          error: {
            code: 'DATABASE_UNAVAILABLE',
            message: 'The EVOQ database is unavailable. Please try again later.',
          },
        },
      },
    };
    const normalized = normalizeApiError(error);

    expect(normalized.status).toBe(503);
    expect(normalized.code).toBe('DATABASE_UNAVAILABLE');
    expect(normalized.message).toContain('database is unavailable');
  });

  it('normalizes 502 Bad Gateway responses', () => {
    const error = {
      response: {
        status: 502,
        statusText: 'Bad Gateway',
        data: '<html>Bad Gateway</html>',
      },
    };
    const normalized = normalizeApiError(error);

    expect(normalized.status).toBe(502);
    expect(normalized.message).toContain('Server is temporarily unavailable');
  });

  it('normalizes 400 validation errors and extracts details', () => {
    const error = {
      response: {
        status: 400,
        data: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: { body: { email: 'Email is required' } },
          },
        },
      },
    };
    const normalized = normalizeApiError(error);

    expect(normalized.status).toBe(400);
    expect(normalized.code).toBe('VALIDATION_ERROR');
    expect(normalized.details.body.email).toBe('Email is required');
  });
});
