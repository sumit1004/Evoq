import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { config } from '../config/env.js';
import { authenticateRequest } from './authMiddleware.js';
import { requireOwnership, requireRoles } from './authorizationMiddleware.js';
import { validateRequest } from './validationMiddleware.js';

function runMiddleware(middleware, requestObject = {}) {
  return new Promise((resolve) => { middleware(requestObject, {}, (error) => resolve({ error, request: requestObject })); });
}

describe('security foundation', () => {
  it('rejects missing and malformed bearer tokens', async () => {
    const missing = await runMiddleware(authenticateRequest, { headers: {} });
    const malformed = await runMiddleware(authenticateRequest, { headers: { authorization: 'Bearer invalid' } });
    expect(missing.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(malformed.error.code).toBe('INVALID_TOKEN');
  });
  it('attaches only the authorized identity claims from a valid token', async () => {
    const token = jwt.sign({ sub: '12', role: 'PLAYER', secretData: 'ignored' }, config.jwtSecret);
    const result = await runMiddleware(authenticateRequest, { headers: { authorization: `Bearer ${token}` } });
    expect(result.error).toBeUndefined();
    expect(result.request.user).toEqual({ id: 12, role: 'PLAYER' });
  });
  it('enforces roles and ownership, with explicit admin bypass', async () => {
    const roleResult = await runMiddleware(requireRoles('ORGANIZER'), { user: { id: 2, role: 'PLAYER' } });
    const ownerResult = await runMiddleware(requireOwnership(async () => ({ ownerId: 9 })), { user: { id: 3, role: 'ORGANIZER' } });
    const adminResult = await runMiddleware(requireOwnership(async () => ({ ownerId: 9 }), { allowRoles: ['ADMIN'] }), { user: { id: 3, role: 'ADMIN' } });
    expect(roleResult.error.code).toBe('FORBIDDEN');
    expect(ownerResult.error.code).toBe('FORBIDDEN');
    expect(adminResult.error).toBeUndefined();
  });
  it('returns structured validation errors', async () => {
    const next = vi.fn();
    validateRequest({ body: (body) => (!body.email ? { email: 'required' } : {}) })({ body: {} }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR', details: { body: { email: 'required' } } }));
  });
  it('adds baseline security headers', async () => {
    const response = await request(createApp()).get('/api/health');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
  });
  it('rate limits repeated authentication attempts', async () => {
    const app = createApp(); let response;
    for (let index = 0; index < 21; index += 1) response = await request(app).post('/api/auth/login').send({ email: 'bad@example.com', password: 'bad-password' });
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('RATE_LIMITED');
  });
});
