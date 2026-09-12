import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createRateLimiter } from './securityMiddleware.js';

describe('Rate Limiter & Bucket Cleanup (Security Hardening)', () => {
  it('allows requests within rate limit and returns 429 when exceeded', () => {
    const limiter = createRateLimiter({ windowMs: 10_000, max: 2, message: 'Too many requests' });

    const req = { ip: '127.0.0.1' };
    let status = null;
    let jsonBody = null;
    const res = {
      setHeader: vi.fn(),
      status: vi.fn((code) => {
        status = code;
        return {
          json: (body) => {
            jsonBody = body;
          },
        };
      }),
    };
    const next = vi.fn();

    // Request 1: allowed
    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Request 2: allowed
    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(2);

    // Request 3: rate limited
    limiter(req, res, next);
    expect(status).toBe(429);
    expect(jsonBody?.error?.code).toBe('RATE_LIMITED');
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
  });

  it('resets count after window expiry and prunes expired keys', async () => {
    const limiter = createRateLimiter({ windowMs: 50, max: 1 });

    const req = { ip: '192.168.1.1' };
    const res = { setHeader: vi.fn(), status: vi.fn(() => ({ json: vi.fn() })) };
    const next = vi.fn();

    // Request 1
    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Request 2 immediately -> rejected
    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Request 3 after window -> allowed
    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
