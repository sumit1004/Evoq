import request from 'supertest';
import { describe, expect, it, beforeAll, beforeEach, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../../app.js';
import {
  setupTestDatabase,
  truncateAllTables,
  closeTestDatabase,
  createTestUser,
  createTestTournament,
  getTestPool,
} from '../testEnvironment.js';
import { saveMediaObject, deleteMediaObject } from '../../services/mediaService.js';

describe('Red-Team Security: Payments, Media & File Upload Attacks', () => {
  let app;
  let pool;

  beforeAll(async () => {
    pool = await setupTestDatabase();
    app = createApp();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('Payment Account Self-Activation & Gateway Tampering Attacks', () => {
    it('forces external payment gateway into PENDING state even when attacker attempts injection', async () => {
      const organizer = await createTestUser({ role: 'ORGANIZER' });

      const res = await request(app)
        .post('/api/organizer/payment-account/connect')
        .set('Authorization', `Bearer ${organizer.token}`)
        .send({
          provider: 'ONLINE',
          providerAccountId: 'acc_tamper_999',
          status: 'ACTIVE',
          onboardingStatus: 'COMPLETED',
          isVerified: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.account.status).toBe('PENDING');
      expect(res.body.account.onboarding_status).toBe('NOT_CONNECTED');

      // Verify in MySQL
      const [rows] = await pool.query(
        'SELECT status, onboarding_status FROM payment_accounts WHERE organizer_id = ? AND provider = "ONLINE"',
        [organizer.id]
      );
      expect(rows[0].status).toBe('PENDING');
      expect(rows[0].onboarding_status).toBe('NOT_CONNECTED');
    });

    it('rejects unauthenticated attempts to view registration payment evidence', async () => {
      const organizer = await createTestUser({ role: 'ORGANIZER' });
      const tournament = await createTestTournament(organizer.id, {
        entry_type: 'PAID',
        entry_fee: 500,
      });

      const player = await createTestUser({ role: 'PLAYER' });
      const [teamRes] = await pool.query('INSERT INTO teams (name, owner_id) VALUES ("T1", ?)', [player.id]);
      const [regRes] = await pool.query(
        'INSERT INTO registrations (tournament_id, team_id, status) VALUES (?, ?, "PENDING")',
        [tournament.id, teamRes.insertId]
      );
      const regId = regRes.insertId;

      await pool.query(
        `INSERT INTO payments (registration_id, tournament_id, organizer_id, provider, amount, status, payment_method, proof_url)
         VALUES (?, ?, ?, "MANUAL_UPI", 500.00, "PAYMENT_SUBMITTED", "MANUAL_UPI", "uploads/proof.png")`,
        [regId, tournament.id, organizer.id]
      );

      // Unauthenticated request
      const unauthRes = await request(app).get(`/api/registrations/${regId}/payment-evidence`);
      expect(unauthRes.status).toBe(401);

      // Unauthorized third-party organizer request (IDOR)
      const attackerOrg = await createTestUser({ role: 'ORGANIZER' });
      const idorRes = await request(app)
        .get(`/api/registrations/${regId}/payment-evidence`)
        .set('Authorization', `Bearer ${attackerOrg.token}`);

      expect(idorRes.status).toBe(403);
    });
  });

  describe('Malicious File Upload & Binary Magic-Number Attacks', () => {
    it('rejects executable binaries disguised with .png extension (Magic Byte Validation)', async () => {
      const tempPath = path.join(os.tmpdir(), `malicious_${Date.now()}.png`);
      // MZ header (DOS/Windows Executable)
      const maliciousBinary = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      await fs.writeFile(tempPath, maliciousBinary);

      await expect(
        saveMediaObject({
          file: {
            path: tempPath,
            mimetype: 'image/png',
            size: maliciousBinary.length,
          },
          category: 'tournaments',
          entityId: '1',
          type: 'qr',
        })
      ).rejects.toMatchObject({
        code: 'UPLOAD_VALIDATION_ERROR',
        status: 400,
      });
    });

    it('rejects script / HTML payloads disguised as webp images', async () => {
      const tempPath = path.join(os.tmpdir(), `xss_${Date.now()}.webp`);
      const scriptPayload = Buffer.from('<script>alert("XSS")</script>');
      await fs.writeFile(tempPath, scriptPayload);

      await expect(
        saveMediaObject({
          file: {
            path: tempPath,
            mimetype: 'image/webp',
            size: scriptPayload.length,
          },
          category: 'profiles',
          entityId: '1',
          type: 'avatar',
        })
      ).rejects.toMatchObject({
        code: 'UPLOAD_VALIDATION_ERROR',
        status: 400,
      });
    });

    it('neutralizes path traversal attempts in media deletion', async () => {
      const traversalKeys = [
        '../../../etc/passwd',
        '..\\..\\..\\Windows\\System32\\cmd.exe',
        '/etc/shadow',
        '....//....//etc/passwd',
      ];

      for (const key of traversalKeys) {
        const result = await deleteMediaObject(key);
        expect(result).toBe(false);
      }
    });
  });
});
