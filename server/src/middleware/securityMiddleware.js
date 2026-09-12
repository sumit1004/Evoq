export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  next();
}

export function createRateLimiter({ windowMs, max, message = 'Too many requests. Please try again later.' }) {
  const buckets = new Map();
  let lastCleanup = Date.now();

  function pruneExpired(now) {
    if (now - lastCleanup > windowMs || buckets.size > 200) {
      for (const [key, record] of buckets.entries()) {
        if (now - record.startedAt >= windowMs) {
          buckets.delete(key);
        }
      }
      lastCleanup = now;
    }
  }

  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    pruneExpired(now);

    const current = buckets.get(key);
    if (!current || now - current.startedAt >= windowMs) {
      buckets.set(key, { startedAt: now, count: 1 });
      return next();
    }
    current.count += 1;
    if (current.count > max) {
      res.setHeader('Retry-After', Math.ceil((windowMs - (now - current.startedAt)) / 1000));
      return res.status(429).json({ error: { code: 'RATE_LIMITED', message } });
    }
    return next();
  };
}

export const authRateLimiter = createRateLimiter({ windowMs: 60_000, max: 20, message: 'Too many authentication attempts. Please wait before trying again.' });
export const chatRateLimiter = createRateLimiter({ windowMs: 10_000, max: 30, message: 'Too many chat messages. Please slow down.' });
export const mutationRateLimiter = createRateLimiter({ windowMs: 60_000, max: 60, message: 'Too many write requests. Please try again later.' });
export const registrationRateLimiter = createRateLimiter({ windowMs: 60_000, max: 30, message: 'Too many registration requests. Please wait before trying again.' });
