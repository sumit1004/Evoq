import request from 'supertest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { config } from '../config/env.js';
import { pool } from '../config/database.js';
import { invalidateUserTokenVersion, getUserTokenVersion } from '../services/identityService.js';
import * as identityRepo from '../repositories/identityRepository.js';

describe('Auth Session Revocation & tokenVersion Lifecycle (AUTH-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createToken(userId = 1, role = 'PLAYER', tokenVersion = 1) {
    return jwt.sign({ role, tokenVersion }, config.jwtSecret, {
      subject: String(userId),
      expiresIn: '24h',
    });
  }

  it('accepts JWT with current tokenVersion', async () => {
    const app = createApp();
    const token = createToken(10, 'PLAYER', 1);

    vi.spyOn(identityRepo, 'findUserById').mockResolvedValue({
      id: 10,
      name: 'Player 10',
      email: 'p10@evoq.gg',
      role: 'PLAYER',
      token_version: 1,
    });

    const res = await request(app)
      .get('/api/player/dashboard')
      .set('Authorization', `Bearer ${token}`);

    // Since token is valid, it shouldn't fail with 401
    expect(res.status).not.toBe(401);
  });

  it('rejects old JWT when user tokenVersion has incremented after password reset', async () => {
    const app = createApp();
    // Old token has tokenVersion = 1
    const oldToken = createToken(10, 'PLAYER', 1);

    // Invalidate cache and mock user with token_version = 2 in database
    invalidateUserTokenVersion(10);
    vi.spyOn(identityRepo, 'findUserById').mockResolvedValue({
      id: 10,
      name: 'Player 10',
      email: 'p10@evoq.gg',
      role: 'PLAYER',
      token_version: 2, // Incremented after password reset
    });

    const res = await request(app)
      .get('/api/player/dashboard')
      .set('Authorization', `Bearer ${oldToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('accepts newly issued JWT with updated tokenVersion', async () => {
    const app = createApp();
    // New token has tokenVersion = 2
    const newToken = createToken(10, 'PLAYER', 2);

    vi.spyOn(identityRepo, 'findUserById').mockResolvedValue({
      id: 10,
      name: 'Player 10',
      email: 'p10@evoq.gg',
      role: 'PLAYER',
      token_version: 2,
    });

    const res = await request(app)
      .get('/api/player/dashboard')
      .set('Authorization', `Bearer ${newToken}`);

    expect(res.status).not.toBe(401);
  });

  it('rejects malformed and expired JWTs', async () => {
    const app = createApp();
    const expiredToken = jwt.sign({ role: 'PLAYER', tokenVersion: 1 }, config.jwtSecret, {
      subject: '10',
      expiresIn: '-1s',
    });

    const expiredRes = await request(app)
      .get('/api/player/dashboard')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(expiredRes.status).toBe(401);

    const malformedRes = await request(app)
      .get('/api/player/dashboard')
      .set('Authorization', 'Bearer not-a-real-jwt');

    expect(malformedRes.status).toBe(401);
  });
});
