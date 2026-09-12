import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { invalidateUserTokenVersion } from '../../services/identityService.js';
import { startServer } from '../../index.js';
import { config } from '../../config/env.js';
import {
  setupTestDatabase,
  truncateAllTables,
  closeTestDatabase,
  createTestUser,
  getTestPool,
} from '../testEnvironment.js';

describe('Server Bootstrap & First Login Request Lifecycle (ECONNRESET Prevention)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('successfully boots server and handles the FIRST login request on a fresh instance without reset', async () => {
    await truncateAllTables();
    const testUser = await createTestUser({
      email: 'player_first_login@evoq.gg',
      password: 'Password123!',
      role: 'PLAYER',
    });

    // Start a fresh server instance with dynamic ephemeral port
    const instance = await startServer({ port: 0, host: '127.0.0.1' });
    expect(instance).toBeDefined();
    expect(instance.port).toBeGreaterThan(0);
    expect(instance.url).toBeDefined();

    try {
      // Step 1: Perform FIRST login attempt immediately
      const firstLoginRes = await fetch(`${instance.url}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password,
        }),
      });

      expect(firstLoginRes.status).toBe(200);
      const firstLoginBody = await firstLoginRes.json();
      expect(firstLoginBody).toHaveProperty('token');
      expect(firstLoginBody).toHaveProperty('identity');
      expect(firstLoginBody.identity.email).toBe(testUser.email);
      expect(firstLoginBody.identity.role).toBe('PLAYER');

      // Step 2: Perform second login attempt on the same running instance
      const secondLoginRes = await fetch(`${instance.url}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password,
        }),
      });

      expect(secondLoginRes.status).toBe(200);
      const secondLoginBody = await secondLoginRes.json();
      expect(secondLoginBody.identity.email).toBe(testUser.email);

      // Step 3: Verify readiness endpoints report 200 OK
      const readyRes = await fetch(`${instance.url}/api/health/ready`);
      expect(readyRes.status).toBe(200);
      const readyBody = await readyRes.json();
      expect(readyBody.status).toBe('ready');
      expect(readyBody.checks.database).toBe(true);

      const dbRes = await fetch(`${instance.url}/api/health/db`);
      expect(dbRes.status).toBe(200);
    } finally {
      await instance.shutdown('TEST_DONE');
    }
  });

  it('safely handles FIRST login request with invalid credentials without crashing or resetting connection', async () => {
    await truncateAllTables();
    await createTestUser({
      email: 'existing_user@evoq.gg',
      password: 'CorrectPassword123!',
      role: 'ORGANIZER',
    });

    // Start another fresh server instance
    const instance = await startServer({ port: 0, host: '127.0.0.1' });

    try {
      // FIRST request is invalid credentials
      const invalidRes = await fetch(`${instance.url}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'existing_user@evoq.gg',
          password: 'WrongPassword!',
        }),
      });

      expect(invalidRes.status).toBe(401);
      const invalidBody = await invalidRes.json();
      expect(invalidBody.error.code).toBe('INVALID_CREDENTIALS');

      // Subsequent valid request still succeeds immediately
      const validRes = await fetch(`${instance.url}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'existing_user@evoq.gg',
          password: 'CorrectPassword123!',
        }),
      });

      expect(validRes.status).toBe(200);
      const validBody = await validRes.json();
      expect(validBody.identity.role).toBe('ORGANIZER');
    } finally {
      await instance.shutdown('TEST_DONE');
    }
  });

  it('preserves expired and revoked token rejection behavior on a freshly started server', async () => {
    await truncateAllTables();
    const user = await createTestUser({
      email: 'token_check@evoq.gg',
      role: 'PLAYER',
      tokenVersion: 2,
    });
    invalidateUserTokenVersion(user.id);

    // Create an expired token and a stale tokenVersion token
    const expiredToken = jwt.sign({ role: 'PLAYER', tokenVersion: 2 }, config.jwtSecret, {
      subject: String(user.id),
      expiresIn: '-1s',
    });
    const revokedToken = jwt.sign({ role: 'PLAYER', tokenVersion: 1 }, config.jwtSecret, {
      subject: String(user.id),
      expiresIn: '1h',
    });

    const instance = await startServer({ port: 0, host: '127.0.0.1' });

    try {
      // Expired token is rejected
      const expiredRes = await fetch(`${instance.url}/api/auth/me`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      expect(expiredRes.status).toBe(401);
      const expiredBody = await expiredRes.json();
      expect(expiredBody.error.code).toBe('INVALID_TOKEN');

      // Stale tokenVersion is rejected
      const revokedRes = await fetch(`${instance.url}/api/auth/me`, {
        headers: { Authorization: `Bearer ${revokedToken}` },
      });
      expect(revokedRes.status).toBe(401);
      const revokedBody = await revokedRes.json();
      expect(revokedBody.error.code).toBe('INVALID_TOKEN');
    } finally {
      await instance.shutdown('TEST_DONE');
    }
  });

  it('deterministically succeeds on FIRST login across 5 fresh server-start cycles for Player, Organizer, and Scout', async () => {
    await truncateAllTables();

    // Create accounts
    const player = await createTestUser({
      email: 'player_cycle@evoq.gg',
      password: 'Password123!',
      role: 'PLAYER',
    });
    const organizer = await createTestUser({
      email: 'organizer_cycle@evoq.gg',
      password: 'Password123!',
      role: 'ORGANIZER',
    });
    const scout = await createTestUser({
      email: 'scout_cycle@evoq.gg',
      password: 'Password123!',
      role: 'PLAYER',
    });

    // Assign scout role in organization
    const pool = getTestPool();
    const [orgRes] = await pool.query(
      'INSERT INTO organizations (name, owner_id) VALUES (?, ?)',
      ['Scout Test Org', organizer.id]
    );
    const orgId = orgRes.insertId;
    await pool.query(
      'INSERT INTO organization_members (organization_id, user_id, role, status) VALUES (?, ?, ?, ?)',
      [orgId, scout.id, 'SCOUT', 'ACTIVE']
    );

    const testUsers = [
      { email: player.email, password: player.password, expectedRole: 'PLAYER' },
      { email: organizer.email, password: organizer.password, expectedRole: 'ORGANIZER' },
      { email: scout.email, password: scout.password, expectedRole: 'PLAYER' },
      { email: player.email, password: player.password, expectedRole: 'PLAYER' },
      { email: organizer.email, password: organizer.password, expectedRole: 'ORGANIZER' },
    ];

    for (let i = 0; i < testUsers.length; i++) {
      const u = testUsers[i];
      // Clean start fresh server instance
      const instance = await startServer({ port: 0, host: '127.0.0.1' });
      try {
        const response = await fetch(`${instance.url}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: u.email,
            password: u.password,
          }),
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty('token');
        expect(body.identity.email).toBe(u.email);
        expect(body.identity.role).toBe(u.expectedRole);
      } finally {
        await instance.shutdown(`CYCLE_${i + 1}_DONE`);
      }
    }
  });
});
