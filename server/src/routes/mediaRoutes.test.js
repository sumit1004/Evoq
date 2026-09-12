import request from 'supertest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../app.js';
import { config } from '../config/env.js';
import jwt from 'jsonwebtoken';

vi.mock('../repositories/registrationRepository.js', () => ({
  findRegistrationFile: vi.fn(),
  findRegistration: vi.fn(),
}));

vi.mock('../services/authorizationService.js', () => ({
  assertTournamentAuthorization: vi.fn(),
  PERMISSIONS: {
    VIEW_PAYMENT_DETAILS: 'VIEW_PAYMENT_DETAILS',
  },
}));

import * as registrationRepo from '../repositories/registrationRepository.js';
import * as authService from '../services/authorizationService.js';

describe('Media Security & Payment Evidence Confidentiality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createTestToken(userId = 1, role = 'ORGANIZER') {
    return jwt.sign({ sub: String(userId), role }, config.jwtSecret);
  }

  it('rejects unauthenticated public access to payment-evidence directory', async () => {
    const app = createApp();
    const res = await request(app).get('/api/media/payment-evidence/secret-receipt.png');

    expect([403, 404]).toContain(res.status);
  });

  it('rejects path traversal attempts on public media route', async () => {
    const app = createApp();
    const res = await request(app).get('/api/media/%2e%2e/secret.png');

    expect([400, 403, 404]).toContain(res.status);
  });

  it('rejects null byte path traversal attempts on public media route', async () => {
    const app = createApp();
    const res = await request(app).get('/api/media/teams/logo.png%00');

    expect([400, 403, 404]).toContain(res.status);
  });

  it('serves allowed public categories (e.g. teams logo) when file exists', async () => {
    const app = createApp();
    const testDir = path.resolve(config.uploadDirectory, 'teams');
    fs.mkdirSync(testDir, { recursive: true });
    const testFile = path.resolve(testDir, 'test-logo.png');
    fs.writeFileSync(testFile, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

    const res = await request(app).get('/api/media/teams/test-logo.png');
    expect(res.status).toBe(200);

    // Cleanup
    try { fs.unlinkSync(testFile); } catch {}
  });

  it('requires authentication for authorized payment-evidence endpoint', async () => {
    const app = createApp();
    const res = await request(app).get('/api/registrations/1/payment-evidence');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('denies payment-evidence access to unauthorized users', async () => {
    const app = createApp();
    const token = createTestToken(999, 'PLAYER');

    registrationRepo.findRegistrationFile.mockResolvedValue({
      id: 1,
      tournament_id: 10,
      organizer_id: 8,
      payment_screenshot_path: 'evidence.png',
    });
    registrationRepo.findRegistration.mockResolvedValue([
      { id: 1, member_id: 101, organizer_id: 8 },
    ]);
    authService.assertTournamentAuthorization.mockRejectedValue(new Error('Forbidden'));

    const res = await request(app)
      .get('/api/registrations/1/payment-evidence')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows tournament organizer to access payment-evidence via authorized endpoint', async () => {
    const app = createApp();
    const token = createTestToken(8, 'ORGANIZER');

    const testDir = path.resolve(config.uploadDirectory, 'payment-evidence');
    fs.mkdirSync(testDir, { recursive: true });
    const testFile = path.resolve(testDir, 'organizer-test-evidence.png');
    fs.writeFileSync(testFile, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

    registrationRepo.findRegistrationFile.mockResolvedValue({
      id: 1,
      tournament_id: 10,
      organizer_id: 8,
      payment_screenshot_path: 'organizer-test-evidence.png',
    });

    const res = await request(app)
      .get('/api/registrations/1/payment-evidence')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // Cleanup
    try { fs.unlinkSync(testFile); } catch {}
  });
});
