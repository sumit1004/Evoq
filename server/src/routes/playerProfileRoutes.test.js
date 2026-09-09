import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

describe('Player Profile & Performance API Routes', () => {
  const app = createApp();

  describe('Unauthenticated Access', () => {
    it('rejects protected player profile without auth token', async () => {
      const res = await request(app).get('/api/players/profile');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('rejects game profiles list without auth token', async () => {
      const res = await request(app).get('/api/players/games');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('rejects practice sessions without auth token', async () => {
      const res = await request(app).get('/api/players/practice/sessions');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('rejects tournament history without auth token', async () => {
      const res = await request(app).get('/api/players/tournaments/history');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  describe('Public Player Search & Profile', () => {
    it('rejects empty query on public player search with 400', async () => {
      const res = await request(app).get('/api/players/search');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 for nonexistent public player profile', async () => {
      const res = await request(app).get('/api/players/EVQ-NONEXISTENT/public');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Validator Return Shapes', () => {
    it('validateEsportsProfileUpdate returns empty object on valid input', async () => {
      const { validateEsportsProfileUpdate } = await import('../validators/playerProfileValidators.js');
      const result = validateEsportsProfileUpdate({
        name: 'ProGamer',
        country: 'India',
        city: 'Mumbai',
        bio: 'Competitive esports athlete',
      });
      expect(Object.keys(result).length).toBe(0);
    });

    it('validateGameProfileCreate returns empty object on valid input', async () => {
      const { validateGameProfileCreate } = await import('../validators/playerProfileValidators.js');
      const result = validateGameProfileCreate({
        gameName: 'Free Fire',
        inGameName: 'ProPlayer',
        gameUid: 'UID-123456',
        primaryRole: 'IGL',
      });
      expect(Object.keys(result).length).toBe(0);
    });

    it('validatePracticeSessionCreate returns empty object on valid input', async () => {
      const { validatePracticeSessionCreate } = await import('../validators/playerProfileValidators.js');
      const result = validatePracticeSessionCreate({
        sessionDate: '2026-09-09',
        gameName: 'Free Fire',
        title: 'Scrim Session 1',
      });
      expect(Object.keys(result).length).toBe(0);
    });
  });
});
