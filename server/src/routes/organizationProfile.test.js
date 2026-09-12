import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import {
  closeTestDatabase,
  createTestUser,
  getTestPool,
  setupTestDatabase,
  truncateAllTables,
} from '../test/testEnvironment.js';

describe('Organization Profile Management API (Real MySQL Integration)', () => {
  let app;
  let pool;

  beforeAll(async () => {
    await setupTestDatabase();
    app = createApp();
    pool = getTestPool();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('allows organizer to fetch and update their organization profile with empty optional fields', async () => {
    const organizer = await createTestUser({
      name: 'Apex Esports Org Admin',
      email: 'admin@apex.gg',
      role: 'ORGANIZER',
    });

    // 1. Fetch organization profile (auto-created on first access)
    const getRes = await request(app)
      .get('/api/organizations/me/profile')
      .set('Authorization', `Bearer ${organizer.token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.organization).toBeDefined();
    expect(getRes.body.organization.name).toContain('Apex Esports');

    // 2. Update organization with valid fields and empty strings for optional fields
    const updatePayload = {
      name: 'Apex Esports International',
      slug: 'apex-esports-intl',
      description: 'Premier tier tournament organizer in SEA region',
      about: 'Founded in 2020 to bring top tier esports events to players.',
      country: 'Singapore',
      city: 'Singapore',
      foundedYear: 2020,
      websiteUrl: 'https://apex.gg',
      discordUrl: 'https://discord.gg/apex',
      twitterUrl: '',
      instagramUrl: '',
      isPublic: true,
    };

    const putRes = await request(app)
      .put('/api/organizations/me/profile')
      .set('Authorization', `Bearer ${organizer.token}`)
      .send(updatePayload);

    expect(putRes.status).toBe(200);
    expect(putRes.body.organization.name).toBe('Apex Esports International');
    expect(putRes.body.organization.slug).toBe('apex-esports-intl');
    expect(putRes.body.organization.twitterUrl).toBeNull();
    expect(putRes.body.organization.instagramUrl).toBeNull();

    // 3. Verify directly in MySQL database
    const [rows] = await pool.query(
      'SELECT name, slug, country, website_url, twitter_url FROM organizations WHERE owner_id = ?',
      [organizer.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Apex Esports International');
    expect(rows[0].slug).toBe('apex-esports-intl');
    expect(rows[0].twitter_url).toBeNull();
  });

  it('rejects update with invalid organization name or invalid slug with 400 validation error', async () => {
    const organizer = await createTestUser({
      name: 'Invalid Test Organizer',
      email: 'invalid@org.gg',
      role: 'ORGANIZER',
    });

    // Short name (< 2 chars)
    const badNameRes = await request(app)
      .put('/api/organizations/me/profile')
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({ name: 'A' });

    expect(badNameRes.status).toBe(400);
    expect(badNameRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(badNameRes.body.error.details.body.name).toBeDefined();

    // Invalid slug with illegal characters
    const badSlugRes = await request(app)
      .put('/api/organizations/me/profile')
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({ name: 'Valid Org Name', slug: 'invalid slug with spaces!' });

    expect(badSlugRes.status).toBe(400);
    expect(badSlugRes.body.error.details.body.slug).toBeDefined();
  });

  it('prevents player from accessing or modifying organizer organization profile with 403', async () => {
    const player = await createTestUser({
      name: 'Casual Player',
      email: 'player@casual.gg',
      role: 'PLAYER',
    });

    const getRes = await request(app)
      .get('/api/organizations/me/profile')
      .set('Authorization', `Bearer ${player.token}`);

    expect(getRes.status).toBe(403);
    expect(getRes.body.error.code).toBe('FORBIDDEN');

    const putRes = await request(app)
      .put('/api/organizations/me/profile')
      .set('Authorization', `Bearer ${player.token}`)
      .send({ name: 'Hacked Org Name' });

    expect(putRes.status).toBe(403);
    expect(putRes.body.error.code).toBe('FORBIDDEN');
  });

  it('prevents duplicate slug across different organizations with 409 Conflict', async () => {
    const org1 = await createTestUser({ email: 'org1@test.gg', role: 'ORGANIZER' });
    const org2 = await createTestUser({ email: 'org2@test.gg', role: 'ORGANIZER' });

    // Org 1 sets slug to 'prime-esports'
    await request(app)
      .put('/api/organizations/me/profile')
      .set('Authorization', `Bearer ${org1.token}`)
      .send({ name: 'Prime Esports', slug: 'prime-esports' });

    // Org 2 tries to claim the same slug
    const clashRes = await request(app)
      .put('/api/organizations/me/profile')
      .set('Authorization', `Bearer ${org2.token}`)
      .send({ name: 'Second Prime', slug: 'prime-esports' });

    expect(clashRes.status).toBe(409);
    expect(clashRes.body.error.code).toBe('CONFLICT');
  });
});
