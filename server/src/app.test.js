import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('API foundation', () => {
  it('returns health status', async () => {
    const response = await request(createApp()).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'evoq-api',
    });
  });

  it('returns a safe 404 shape for unknown routes', async () => {
    const response = await request(createApp()).get('/api/missing');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('rejects protected player profile access without a token', async () => {
    const response = await request(createApp()).get('/api/players/me');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('returns structured validation errors before identity persistence', async () => {
    const response = await request(createApp())
      .post('/api/auth/signup')
      .send({ name: 'A', email: 'invalid', password: 'short', role: 'ADMIN' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.body).toEqual(expect.objectContaining({
      email: expect.any(String),
      password: expect.any(String),
      role: expect.any(String),
    }));
  });

  it('requires player authentication for team access', async () => {
    const response = await request(createApp()).get('/api/teams');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

});
