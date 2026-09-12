import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../../app.js';
import { config } from '../../config/env.js';
import {
  getTestPool,
  closeTestPool,
  truncateAllTables,
  createTestUser,
  createTestTournament,
} from '../testEnvironment.js';
import {
  saveMediaObject,
  deleteMediaObject,
  hasAllowedImageSignature,
} from '../../services/mediaService.js';

describe('Payments & Media Security Integration Suite (Real MySQL)', () => {
  let pool;
  let app;

  beforeAll(async () => {
    pool = await getTestPool();
    app = createApp();
  });

  afterAll(async () => {
    await closeTestPool();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  describe('Payment Accounts Security & Database Persistence', () => {
    it('saves MANUAL_UPI payment account directly into MySQL with ACTIVE status', async () => {
      const { user: organizer, token } = await createTestUser({ role: 'ORGANIZER' });

      const res = await request(app)
        .post('/api/organizer/payment-account/connect')
        .set('Authorization', `Bearer ${token}`)
        .send({
          provider: 'MANUAL_UPI',
          providerAccountId: 'organizer_upi@bank',
          currency: 'INR',
        });

      expect(res.status).toBe(200);
      expect(res.body.account).toBeDefined();
      expect(res.body.account.provider).toBe('MANUAL_UPI');
      expect(res.body.account.status).toBe('ACTIVE');
      expect(res.body.account.onboarding_status).toBe('COMPLETED');

      // Verify directly in MySQL payment_accounts table
      const [rows] = await pool.query(
        'SELECT * FROM payment_accounts WHERE organizer_id = ? AND provider = ?',
        [organizer.id, 'MANUAL_UPI']
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].provider_account_id).toBe('organizer_upi@bank');
      expect(rows[0].status).toBe('ACTIVE');
      expect(rows[0].onboarding_status).toBe('COMPLETED');
    });

    it('strips client self-activation payload for external gateways in MySQL', async () => {
      const { user: organizer, token } = await createTestUser({ role: 'ORGANIZER' });

      // Client maliciously sends status: 'ACTIVE' and onboardingStatus: 'COMPLETED'
      const res = await request(app)
        .post('/api/organizer/payment-account/connect')
        .set('Authorization', `Bearer ${token}`)
        .send({
          provider: 'RAZORPAY',
          providerAccountId: 'acc_malicious_123',
          status: 'ACTIVE',
          onboardingStatus: 'COMPLETED',
          currency: 'INR',
        });

      expect(res.status).toBe(200);
      expect(res.body.account.status).toBe('PENDING');
      expect(res.body.account.onboarding_status).toBe('NOT_CONNECTED');

      // Verify directly in MySQL
      const [rows] = await pool.query(
        'SELECT * FROM payment_accounts WHERE organizer_id = ? AND provider = ?',
        [organizer.id, 'RAZORPAY']
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('PENDING');
      expect(rows[0].onboarding_status).toBe('NOT_CONNECTED');
    });

    it('prevents non-organizers from connecting payment accounts', async () => {
      const { token: playerToken } = await createTestUser({ role: 'PLAYER' });

      const res = await request(app)
        .post('/api/organizer/payment-account/connect')
        .set('Authorization', `Bearer ${playerToken}`)
        .send({
          provider: 'MANUAL_UPI',
          providerAccountId: 'fake_upi@bank',
        });

      expect(res.status).toBe(403);

      // Verify nothing is written to MySQL
      const [rows] = await pool.query('SELECT * FROM payment_accounts');
      expect(rows).toHaveLength(0);
    });

    it('deletes payment account from MySQL correctly', async () => {
      const { user: organizer, token } = await createTestUser({ role: 'ORGANIZER' });

      await pool.query(
        `INSERT INTO payment_accounts (organizer_id, provider, provider_account_id, status, onboarding_status, currency)
         VALUES (?, 'MANUAL_UPI', 'upi@test', 'ACTIVE', 'COMPLETED', 'INR')`,
        [organizer.id]
      );

      const res = await request(app)
        .delete('/api/organizer/payment-account')
        .set('Authorization', `Bearer ${token}`)
        .send({ provider: 'MANUAL_UPI' });

      expect(res.status).toBe(200);

      const [rows] = await pool.query(
        'SELECT * FROM payment_accounts WHERE organizer_id = ? AND provider = ?',
        [organizer.id, 'MANUAL_UPI']
      );
      expect(rows).toHaveLength(0);
    });
  });

  describe('Tournament Payment Summary & Access Control', () => {
    it('returns payment summary for organizer and forbids unauthorized organizers', async () => {
      const { user: organizerA, token: tokenA } = await createTestUser({ role: 'ORGANIZER' });
      const { token: tokenB } = await createTestUser({ role: 'ORGANIZER' });
      const tournament = await createTestTournament(organizerA.id, {
        entryType: 'PAID',
        entryFee: 500,
      });

      const { user: player } = await createTestUser({ role: 'PLAYER' });
      const [teamRes] = await pool.query('INSERT INTO teams (name, owner_id) VALUES (?, ?)', ['Team Alpha', player.id]);
      const [regRes] = await pool.query(
        'INSERT INTO registrations (tournament_id, team_id, status) VALUES (?, ?, ?)',
        [tournament.id, teamRes.insertId, 'PENDING']
      );

      // Insert some fake payments in MySQL
      await pool.query(
        `INSERT INTO payments (registration_id, tournament_id, organizer_id, provider, amount, status, payment_method, transaction_reference)
         VALUES (?, ?, ?, 'MANUAL_UPI', 500.00, 'PAID', 'MANUAL_UPI', 'TXN_001')`,
        [regRes.insertId, tournament.id, organizerA.id]
      );

      // Organizer A can get summary
      const resA = await request(app)
        .get(`/api/tournaments/${tournament.id}/payment-summary`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resA.status).toBe(200);
      expect(resA.body.summary).toBeDefined();

      // Organizer B is forbidden
      const resB = await request(app)
        .get(`/api/tournaments/${tournament.id}/payment-summary`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(resB.status).toBe(403);
    });
  });

  describe('Media Upload Validation & Path Traversal Protections', () => {
    it('validates binary magic numbers for PNG images and rejects spoofed files', async () => {
      const validPngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
      const invalidHeader = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ executable

      expect(await hasAllowedImageSignature(validPngHeader, 'image/png')).toBe(true);
      expect(await hasAllowedImageSignature(invalidHeader, 'image/png')).toBe(false);
    });

    it('saves valid media and deletes safely preventing path traversal', async () => {
      const tempDir = os.tmpdir();
      const testFilePath = path.join(tempDir, `test_img_${Date.now()}.png`);
      const validPngContent = Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        Buffer.alloc(50),
      ]);
      await fs.writeFile(testFilePath, validPngContent);

      const savedMedia = await saveMediaObject({
        file: {
          path: testFilePath,
          mimetype: 'image/png',
          size: validPngContent.length,
        },
        category: 'tournaments',
        entityId: '42',
        type: 'banner',
      });

      expect(savedMedia.objectKey).toMatch(/^tournaments\/42\/banner\/[a-f0-9-]+\.png$/);
      expect(savedMedia.url).toBe(`/api/media/${savedMedia.objectKey}`);

      // Verify file exists in uploadDirectory
      const fullPath = path.resolve(config.uploadDirectory, savedMedia.objectKey);
      const exists = await fs.stat(fullPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      // Verify delete prevents traversal
      const deleteAttempt = await deleteMediaObject('../../../etc/passwd');
      expect(deleteAttempt).toBe(false);

      // Clean up saved file
      const deleted = await deleteMediaObject(savedMedia.objectKey);
      expect(deleted).toBe(true);
    });
  });
});
