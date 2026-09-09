import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

describe('Organization API Routes', () => {
  const app = createApp();

  describe('Public Discovery Endpoints', () => {
    it('returns 404 for nonexistent organization profile', async () => {
      const res = await request(app).get('/api/organizations/nonexistent-org-slug-999');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for nonexistent organization tournaments', async () => {
      const res = await request(app).get('/api/organizations/nonexistent-org-slug-999/tournaments');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Protected Organizer Settings Endpoints', () => {
    it('rejects unauthenticated get my organization with 401', async () => {
      const res = await request(app).get('/api/organizations/me/profile');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('rejects unauthenticated update my organization with 401', async () => {
      const res = await request(app)
        .put('/api/organizations/me/profile')
        .send({ name: 'New Org Name' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });
});
