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

describe('REAL MySQL & API Integration: Authentication & Identity', () => {
  let app;

  beforeAll(async () => {
    await setupTestDatabase();
    app = createApp();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('registers a new player account and persists user & player profile in MySQL', async () => {
    const signupPayload = {
      name: 'Viper Strike',
      email: 'viper@evoq.gg',
      password: 'StrongPassword123!',
      role: 'PLAYER',
      inGameName: 'VIPER_99',
      mobile: '+919876543210',
    };

    const res = await request(app)
      .post('/api/auth/signup')
      .send(signupPayload);

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.identity.name).toBe('Viper Strike');
    expect(res.body.identity.role).toBe('PLAYER');
    expect(res.body.identity.profile.uniquePlayerId).toBeDefined();

    // Verify MySQL persistence
    const pool = getTestPool();
    const [userRows] = await pool.query('SELECT * FROM users WHERE email = ?', ['viper@evoq.gg']);
    expect(userRows.length).toBe(1);
    expect(userRows[0].role).toBe('PLAYER');

    const [profileRows] = await pool.query('SELECT * FROM player_profiles WHERE user_id = ?', [userRows[0].id]);
    expect(profileRows.length).toBe(1);
    expect(profileRows[0].in_game_name).toBe('VIPER_99');
  });

  it('registers a new organizer account and initializes organization membership in MySQL', async () => {
    const signupPayload = {
      name: 'Alpha Events',
      email: 'organizer@evoq.gg',
      password: 'StrongPassword123!',
      role: 'ORGANIZER',
    };

    const res = await request(app)
      .post('/api/auth/signup')
      .send(signupPayload);

    expect(res.status).toBe(201);
    expect(res.body.identity.role).toBe('ORGANIZER');

    const pool = getTestPool();
    const [userRows] = await pool.query('SELECT * FROM users WHERE email = ?', ['organizer@evoq.gg']);
    expect(userRows.length).toBe(1);
    expect(userRows[0].role).toBe('ORGANIZER');
  });

  it('authenticates user with correct credentials and returns JWT + identity', async () => {
    await createTestUser({
      name: 'Pro Gamer',
      email: 'gamer@evoq.gg',
      password: 'ValidPassword123!',
      role: 'PLAYER',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'gamer@evoq.gg',
        password: 'ValidPassword123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.identity.email).toBe('gamer@evoq.gg');
    expect(res.body.identity.role).toBe('PLAYER');

    // Decode and verify JWT
    const decoded = jwt.verify(res.body.token, config.jwtSecret);
    expect(decoded.role).toBe('PLAYER');
    expect(decoded.tokenVersion).toBeDefined();
  });

  it('rejects authentication with invalid credentials (wrong password & unknown email)', async () => {
    await createTestUser({
      email: 'known@evoq.gg',
      password: 'CorrectPassword123!',
    });

    // Wrong password
    const wrongPassRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'known@evoq.gg', password: 'WrongPassword999!' });

    expect(wrongPassRes.status).toBe(401);

    // Unknown email
    const unknownUserRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@evoq.gg', password: 'AnyPassword123!' });

    expect(unknownUserRes.status).toBe(401);
  });

  it('validates JWT token and handles expired/malformed tokens securely', async () => {
    const user = await createTestUser({ role: 'PLAYER' });

    // Valid token
    const validRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${user.token}`);

    expect(validRes.status).toBe(200);
    expect(validRes.body.identity.id).toBe(user.id);

    // Expired JWT
    const expiredToken = jwt.sign({ role: 'PLAYER', tokenVersion: 1 }, config.jwtSecret, {
      subject: String(user.id),
      expiresIn: '-10s',
    });
    const expiredRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(expiredRes.status).toBe(401);

    // Malformed JWT
    const malformedRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer gibberish.token.here');

    expect(malformedRes.status).toBe(401);
  });

  it('authenticates PLAYER, ORGANIZER, and ADMIN roles seamlessly', async () => {
    const player = await createTestUser({ role: 'PLAYER' });
    const organizer = await createTestUser({ role: 'ORGANIZER' });
    const admin = await createTestUser({ role: 'ADMIN' });

    const playerMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${player.token}`);
    expect(playerMe.status).toBe(200);
    expect(playerMe.body.identity.role).toBe('PLAYER');

    const orgMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${organizer.token}`);
    expect(orgMe.status).toBe(200);
    expect(orgMe.body.identity.role).toBe('ORGANIZER');

    const adminMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${admin.token}`);
    expect(adminMe.status).toBe(200);
    expect(adminMe.body.identity.role).toBe('ADMIN');
  });

  it('confirms removed password reset endpoints return 404', async () => {
    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'test@evoq.gg' });
    expect(forgotRes.status).toBe(404);

    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'abc', newPassword: 'Pass' });
    expect(resetRes.status).toBe(404);
  });
});
