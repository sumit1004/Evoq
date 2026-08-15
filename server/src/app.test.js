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
});
