import request from 'supertest';
import { describe, expect, it, beforeAll, beforeEach, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { config } from '../../config/env.js';
import {
  setupTestDatabase,
  truncateAllTables,
  closeTestDatabase,
  createTestUser,
  getTestPool,
} from '../testEnvironment.js';

describe('Red-Team Security: Authentication, JWT & Removed Endpoint Hardening', () => {
  let app;
  let pool;

  beforeAll(async () => {
    pool = await setupTestDatabase();
    app = createApp();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('JWT Signature & Token Manipulation Attacks', () => {
    it('rejects requests with missing Authorization header', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('rejects tokens signed with an arbitrary malicious secret', async () => {
      const user = await createTestUser({ role: 'PLAYER' });
      const forgedToken = jwt.sign(
        { role: 'ADMIN', tokenVersion: 1 },
        'ATTACKER_MALICIOUS_SECRET_KEY_123',
        { subject: String(user.id) }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('rejects tokens with none algorithm (alg=none attack)', async () => {
      const user = await createTestUser({ role: 'ADMIN' });
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: String(user.id), role: 'ADMIN', tokenVersion: 1 })).toString('base64url');
      const noneToken = `${header}.${payload}.`;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${noneToken}`);

      expect(res.status).toBe(401);
    });

    it('rejects expired tokens regardless of valid signature', async () => {
      const user = await createTestUser({ role: 'PLAYER' });
      const expiredToken = jwt.sign(
        { role: 'PLAYER', tokenVersion: 1 },
        config.jwtSecret,
        { subject: String(user.id), expiresIn: '-5m' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });

    it('rejects token when tokenVersion does not match current MySQL user token_version', async () => {
      const user = await createTestUser({ role: 'PLAYER', tokenVersion: 1 });
      
      const staleToken = jwt.sign(
        { role: 'PLAYER', tokenVersion: 1 },
        config.jwtSecret,
        { subject: String(user.id) }
      );

      await pool.query('UPDATE users SET token_version = 2 WHERE id = ?', [user.id]);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${staleToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('Removed Forgot Password Endpoints Hardening', () => {
    it('returns 404 for removed POST /api/auth/forgot-password endpoint', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@evoq.gg' });

      expect(res.status).toBe(404);
    });

    it('returns 404 for removed POST /api/auth/reset-password endpoint', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff', newPassword: 'NewPassword123!' });

      expect(res.status).toBe(404);
    });

    it('returns 404 for removed GET /api/auth/reset-password/:token endpoint', async () => {
      const res = await request(app)
        .get('/api/auth/reset-password/1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff');

      expect(res.status).toBe(404);
    });
  });
});
