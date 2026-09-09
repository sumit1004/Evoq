import { describe, expect, it, vi } from 'vitest';
import {
  generateSecureResetToken,
  hashResetToken,
  requestPasswordReset,
  resetPassword,
  validateResetToken,
} from './passwordResetService.js';
import * as identityRepository from '../repositories/identityRepository.js';
import * as passwordResetRepository from '../repositories/passwordResetRepository.js';
import * as emailService from './emailService.js';
import { pool } from '../config/database.js';

describe('passwordResetService', () => {
  it('generates secure 64-character hexadecimal tokens and hashes them deterministically', () => {
    const rawToken = generateSecureResetToken();
    expect(rawToken).toMatch(/^[0-9a-f]{64}$/);

    const hash1 = hashResetToken(rawToken);
    const hash2 = hashResetToken(rawToken);
    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });

  describe('requestPasswordReset', () => {
    it('returns generic success message and does not send email if user does not exist (anti-enumeration)', async () => {
      vi.spyOn(identityRepository, 'findUserByEmail').mockResolvedValueOnce(null);
      const emailSpy = vi.spyOn(emailService, 'sendPasswordResetEmail');

      const result = await requestPasswordReset('nonexistent@evoqgaming.com');

      expect(result).toEqual({
        message: 'If an account matches that email address, a password reset link has been sent.',
      });
      expect(emailSpy).not.toHaveBeenCalled();
    });

    it('creates token and sends reset email when user exists', async () => {
      const mockUser = {
        id: 42,
        name: 'Alex Pro',
        email: 'alex@evoqgaming.com',
        role: 'PLAYER',
      };
      vi.spyOn(identityRepository, 'findUserByEmail').mockResolvedValueOnce(mockUser);
      const invalidateSpy = vi.spyOn(passwordResetRepository, 'invalidateUserTokens').mockResolvedValueOnce();
      const createTokenSpy = vi.spyOn(passwordResetRepository, 'createPasswordResetToken').mockResolvedValueOnce({ id: 101 });
      const emailSpy = vi.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValueOnce({ id: 'resend_msg_123' });

      const result = await requestPasswordReset('Alex@EVOQGAMING.com');

      expect(result).toEqual({
        message: 'If an account matches that email address, a password reset link has been sent.',
      });
      expect(invalidateSpy).toHaveBeenCalledWith(42);
      expect(createTokenSpy).toHaveBeenCalled();
      expect(emailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'alex@evoqgaming.com',
          name: 'Alex Pro',
          resetUrl: expect.stringContaining('/reset-password/'),
          expiresMinutes: 30,
        }),
      );
    });
  });

  describe('validateResetToken', () => {
    it('throws badRequest if token format is invalid', async () => {
      await expect(validateResetToken('invalid-token-short')).rejects.toThrow('Invalid or expired password reset link');
      await expect(validateResetToken('')).rejects.toThrow('Invalid or expired password reset link');
    });

    it('throws badRequest if token is not found or expired', async () => {
      const validHex = 'a'.repeat(64);
      vi.spyOn(passwordResetRepository, 'findValidTokenByHash').mockResolvedValueOnce(null);

      await expect(validateResetToken(validHex)).rejects.toThrow('Invalid or expired password reset link');
    });

    it('returns valid: true and masked email when token is found', async () => {
      const validHex = 'b'.repeat(64);
      vi.spyOn(passwordResetRepository, 'findValidTokenByHash').mockResolvedValueOnce({
        id: 1,
        user_id: 10,
        email: 'playerone@evoq.gg',
      });

      const result = await validateResetToken(validHex);
      expect(result.valid).toBe(true);
      expect(result.email).toBe('p*****e@evoq.gg');
    });
  });

  describe('resetPassword', () => {
    it('validates password length', async () => {
      const validHex = 'c'.repeat(64);
      await expect(resetPassword({ token: validHex, newPassword: 'short' })).rejects.toThrow('Validation failed');
    });

    it('performs transactional password update and invalidation', async () => {
      const validHex = 'd'.repeat(64);
      const mockConnection = {
        beginTransaction: vi.fn().mockResolvedValue(),
        query: vi.fn()
          .mockResolvedValueOnce([[{ id: 9, user_id: 77, email: 'sumit@evoq.gg' }]]) // SELECT FOR UPDATE
          .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE users
          .mockResolvedValueOnce([{ affectedRows: 1 }]), // UPDATE password_reset_tokens
        commit: vi.fn().mockResolvedValue(),
        rollback: vi.fn().mockResolvedValue(),
        release: vi.fn(),
      };

      vi.spyOn(pool, 'getConnection').mockResolvedValueOnce(mockConnection);

      const result = await resetPassword({
        token: validHex,
        newPassword: 'SecureNewPassword123!',
      });

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
      expect(result.message).toContain('Password has been reset successfully');
    });
  });
});
