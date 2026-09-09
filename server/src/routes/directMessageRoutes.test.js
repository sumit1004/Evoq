import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

describe('Direct Messaging API Routes', () => {
  const app = createApp();

  describe('Authentication Enforcement', () => {
    it('rejects unauthenticated conversations listing with 401', async () => {
      const res = await request(app).get('/api/messages/conversations');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('rejects unauthenticated create conversation with 401', async () => {
      const res = await request(app)
        .post('/api/messages/conversations')
        .send({ recipientUserId: 2 });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('rejects unauthenticated message send with 401', async () => {
      const res = await request(app)
        .post('/api/messages/conversations/1/messages')
        .send({ message: 'Hello' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });
});
