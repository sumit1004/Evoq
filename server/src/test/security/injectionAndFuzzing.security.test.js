import request from 'supertest';
import { describe, expect, it, beforeAll, beforeEach, afterAll } from 'vitest';
import { createApp } from '../../app.js';
import {
  setupTestDatabase,
  truncateAllTables,
  closeTestDatabase,
  createTestUser,
  createTestTournament,
  getTestPool,
} from '../testEnvironment.js';

describe('Red-Team Security: Injection, Type Fuzzing & Information Leakage Attacks', () => {
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

  describe('SQL Injection Attacks across Search & Filter Endpoints', () => {
    it('safely handles classic SQL injection in search parameters without leaking data or throwing syntax errors', async () => {
      const organizer = await createTestUser({ role: 'ORGANIZER' });
      await createTestTournament(organizer.id, { name: 'Legitimate Tournament', status: 'REGISTRATION_OPEN' });

      const sqliPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE tournaments; --",
        "' UNION SELECT id, name, email, password_hash, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20 FROM users --",
        "1' AND SLEEP(5) --",
        "admin'--",
      ];

      for (const payload of sqliPayloads) {
        const res = await request(app)
          .get('/api/tournaments')
          .query({ search: payload });

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.tournaments)).toBe(true);
      }

      // Verify tournaments table was NOT dropped or modified
      const [rows] = await pool.query('SELECT COUNT(*) AS count FROM tournaments');
      expect(Number(rows[0].count)).toBe(1);
    });

    it('safely normalizes NaN, negative, and infinite values in pagination parameters', async () => {
      const res = await request(app)
        .get('/api/tournaments')
        .query({
          page: '-5',
          limit: 'NaN',
          offset: 'Infinity',
        });

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(12);
    });
  });

  describe('Information Leakage & Sensitive Data Protection', () => {
    it('never exposes password_hash or internal secrets in user identity API responses', async () => {
      const user = await createTestUser({ role: 'PLAYER' });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user.token}`);

      expect(res.status).toBe(200);
      const identity = res.body.identity;

      expect(identity.password_hash).toBeUndefined();
      expect(identity.passwordHash).toBeUndefined();
      expect(identity.jwtSecret).toBeUndefined();
      expect(identity.token_version).toBeUndefined();
    });

    it('sanitizes error responses and does not leak raw database stack traces or SQL schemas', async () => {
      // Trigger a 404 or validation error
      const res = await request(app).get('/api/tournaments/999999');

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.message).toBeDefined();
      // Ensure stack trace and raw SQL code are not leaked to API consumers
      expect(res.body.stack).toBeUndefined();
      expect(res.body.sql).toBeUndefined();
    });
  });

  describe('Prototype Pollution & Malformed Input Defenses', () => {
    it('safely handles prototype pollution keys in JSON request bodies', async () => {
      const organizer = await createTestUser({ role: 'ORGANIZER' });

      const res = await request(app)
        .post('/api/tournaments')
        .set('Authorization', `Bearer ${organizer.token}`)
        .send({
          __proto__: { isAdmin: true },
          constructor: { prototype: { isOwner: true } },
          name: 'Prototype Protected Cup',
          registrationStartAt: new Date().toISOString(),
          registrationEndAt: new Date(Date.now() + 86400000).toISOString(),
          maxTeams: 8,
          playersPerTeam: 4,
          entryType: 'FREE',
        });

      expect(res.status).toBe(201);
      expect(Object.prototype.isAdmin).toBeUndefined();
      expect(Object.prototype.isOwner).toBeUndefined();
    });
  });
});
