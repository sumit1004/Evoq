import request from 'supertest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { config } from '../config/env.js';
import * as paymentRepo from '../repositories/paymentRepository.js';
import * as identityRepo from '../repositories/identityRepository.js';

vi.mock('../repositories/paymentRepository.js', () => ({
  findPaymentAccount: vi.fn(),
  getPaymentAccountById: vi.fn(),
  upsertPaymentAccount: vi.fn(),
  deletePaymentAccount: vi.fn(),
  getPaymentSummary: vi.fn(),
}));

describe('Payment Account Security & Self-Activation Prevention (PAY-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createToken(userId = 1, role = 'ORGANIZER', tokenVersion = 1) {
    return jwt.sign({ role, tokenVersion }, config.jwtSecret, {
      subject: String(userId),
    });
  }

  it('rejects unauthenticated requests to payment endpoints', async () => {
    const app = createApp();
    const res = await request(app).get('/api/organizer/payment-account');
    expect(res.status).toBe(401);
  });

  it('blocks non-organizers from connecting payment accounts', async () => {
    const app = createApp();
    const playerToken = createToken(5, 'PLAYER');

    vi.spyOn(identityRepo, 'findUserById').mockResolvedValue({
      id: 5,
      role: 'PLAYER',
      token_version: 1,
    });

    const res = await request(app)
      .post('/api/organizer/payment-account/connect')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ provider: 'MANUAL_UPI' });

    expect(res.status).toBe(403);
  });

  it('forces PENDING/NOT_CONNECTED status for external gateways even if client sends ACTIVE/COMPLETED', async () => {
    const app = createApp();
    const organizerToken = createToken(8, 'ORGANIZER');

    vi.spyOn(identityRepo, 'findUserById').mockResolvedValue({
      id: 8,
      role: 'ORGANIZER',
      token_version: 1,
    });

    paymentRepo.upsertPaymentAccount.mockResolvedValue(101);
    paymentRepo.getPaymentAccountById.mockResolvedValue({
      id: 101,
      organizer_id: 8,
      provider: 'RAZORPAY',
      provider_account_id: 'acc_fake123',
      status: 'PENDING',
      onboarding_status: 'NOT_CONNECTED',
      currency: 'INR',
    });

    const res = await request(app)
      .post('/api/organizer/payment-account/connect')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        provider: 'RAZORPAY',
        providerAccountId: 'acc_fake123',
        status: 'ACTIVE', // Client attempts self-activation
        onboardingStatus: 'COMPLETED', // Client attempts self-activation
      });

    expect(res.status).toBe(200);
    // Verified that controller passed status: PENDING and onboardingStatus: NOT_CONNECTED to repo
    expect(paymentRepo.upsertPaymentAccount).toHaveBeenCalledWith(8, {
      provider: 'RAZORPAY',
      providerAccountId: 'acc_fake123',
      status: 'PENDING',
      onboardingStatus: 'NOT_CONNECTED',
      currency: undefined,
    });
    expect(res.body.account.status).toBe('PENDING');
  });

  it('allows MANUAL_UPI to be configured as ACTIVE/COMPLETED for direct organizer QR payments', async () => {
    const app = createApp();
    const organizerToken = createToken(8, 'ORGANIZER');

    vi.spyOn(identityRepo, 'findUserById').mockResolvedValue({
      id: 8,
      role: 'ORGANIZER',
      token_version: 1,
    });

    paymentRepo.upsertPaymentAccount.mockResolvedValue(102);
    paymentRepo.getPaymentAccountById.mockResolvedValue({
      id: 102,
      organizer_id: 8,
      provider: 'MANUAL_UPI',
      provider_account_id: 'organizer@okaxis',
      status: 'ACTIVE',
      onboarding_status: 'COMPLETED',
      currency: 'INR',
    });

    const res = await request(app)
      .post('/api/organizer/payment-account/connect')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        provider: 'MANUAL_UPI',
        providerAccountId: 'organizer@okaxis',
      });

    expect(res.status).toBe(200);
    expect(paymentRepo.upsertPaymentAccount).toHaveBeenCalledWith(8, {
      provider: 'MANUAL_UPI',
      providerAccountId: 'organizer@okaxis',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
      currency: undefined,
    });
    expect(res.body.account.status).toBe('ACTIVE');
  });
});
