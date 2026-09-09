import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { config } from '../config/env.js';
import { errorResponses } from '../errors/AppError.js';
import { findUserByEmail } from '../repositories/identityRepository.js';
import {
  createPasswordResetToken,
  findValidTokenByHash,
  invalidateUserTokens,
} from '../repositories/passwordResetRepository.js';
import { sendPasswordResetEmail } from './emailService.js';
import { maskEmail, normalizeEmail } from '../utils/identity.js';
import { logger } from '../utils/logger.js';

const passwordCost = 12;
const TOKEN_EXPIRY_MINUTES = 30;
const HEX_TOKEN_REGEX = /^[0-9a-f]{64}$/i;

export function hashResetToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateSecureResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function requestPasswordReset(email) {
  const normalized = normalizeEmail(email);
  const user = await findUserByEmail(normalized);

  if (user) {
    try {
      // Invalidate any previously active tokens for this user
      await invalidateUserTokens(user.id);

      const rawToken = generateSecureResetToken();
      const tokenHash = hashResetToken(rawToken);
      const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

      await createPasswordResetToken({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      const baseUrl = config.appUrl.replace(/\/$/, '');
      const resetUrl = `${baseUrl}/reset-password/${rawToken}`;

      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
        expiresMinutes: TOKEN_EXPIRY_MINUTES,
      });
    } catch (error) {
      logger.error('request_password_reset_error', {
        userId: user.id,
        error: error.message,
      });
      // Continue without throwing to prevent timing/enumeration leakage
    }
  }

  // Consistent message returned regardless of user existence
  return {
    message: 'If an account matches that email address, a password reset link has been sent.',
  };
}

export async function validateResetToken(rawToken) {
  if (typeof rawToken !== 'string' || !HEX_TOKEN_REGEX.test(rawToken.trim())) {
    throw errorResponses.badRequest('Invalid or expired password reset link');
  }

  const tokenHash = hashResetToken(rawToken.trim());
  const record = await findValidTokenByHash(tokenHash);

  if (!record) {
    throw errorResponses.badRequest('Invalid or expired password reset link');
  }

  return {
    valid: true,
    email: maskEmail(record.email),
  };
}

export async function resetPassword({ token: rawToken, newPassword }) {
  if (typeof rawToken !== 'string' || !HEX_TOKEN_REGEX.test(rawToken.trim())) {
    throw errorResponses.badRequest('Invalid or expired password reset link');
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
    throw errorResponses.validation({
      newPassword: 'Password must be between 8 and 128 characters',
    });
  }

  const tokenHash = hashResetToken(rawToken.trim());
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT
         prt.id,
         prt.user_id,
         u.email
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = ?
         AND prt.used_at IS NULL
         AND prt.expires_at > NOW()
       FOR UPDATE`,
      [tokenHash],
    );

    const record = rows[0];
    if (!record) {
      await connection.rollback();
      throw errorResponses.badRequest('Invalid or expired password reset link');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, passwordCost);

    // Update password and increment token_version to revoke existing sessions
    await connection.query(
      'UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = NOW() WHERE id = ?',
      [newPasswordHash, record.user_id],
    );

    // Invalidate all tokens for this user
    await connection.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
      [record.user_id],
    );

    await connection.commit();

    logger.info('password_reset_successful', {
      userId: record.user_id,
    });

    return {
      message: 'Password has been reset successfully. Please log in with your new password.',
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
