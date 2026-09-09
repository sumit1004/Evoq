import { pool } from '../config/database.js';

export async function createPasswordResetToken({ userId, tokenHash, expiresAt }, connection = null) {
  const runner = connection || pool;
  const [result] = await runner.query(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt],
  );
  return { id: result.insertId };
}

export async function findValidTokenByHash(tokenHash, connection = null) {
  const runner = connection || pool;
  const [rows] = await runner.query(
    `SELECT
       prt.id,
       prt.user_id,
       prt.token_hash,
       prt.expires_at,
       prt.used_at,
       prt.created_at,
       u.email,
       u.name,
       u.role,
       u.token_version
     FROM password_reset_tokens prt
     JOIN users u ON u.id = prt.user_id
     WHERE prt.token_hash = ?
       AND prt.used_at IS NULL
       AND prt.expires_at > NOW()
     LIMIT 1`,
    [tokenHash],
  );
  return rows[0] || null;
}

export async function invalidateUserTokens(userId, connection = null) {
  const runner = connection || pool;
  await runner.query(
    'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
    [userId],
  );
}

export async function markTokenUsed(tokenId, connection = null) {
  const runner = connection || pool;
  await runner.query(
    'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?',
    [tokenId],
  );
}

export async function cleanupExpiredTokens() {
  const [result] = await pool.query(
    'DELETE FROM password_reset_tokens WHERE expires_at < DATE_SUB(NOW(), INTERVAL 7 DAY)',
  );
  return result.affectedRows;
}
