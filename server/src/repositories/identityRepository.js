import { pool } from '../config/database.js';

export async function findUserByEmail(email) {
  const [rows] = await pool.query(
    'SELECT id, name, email, password_hash, role, created_at, updated_at FROM users WHERE email = ? LIMIT 1',
    [email],
  );
  return rows[0] || null;
}

export async function findUserById(userId) {
  const [rows] = await pool.query(
    'SELECT id, name, email, password_hash, role, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  return rows[0] || null;
}

export async function findProfileByUserId(userId) {
  const [rows] = await pool.query(
    'SELECT user_id, unique_player_id, mobile, in_game_name, game_uid FROM player_profiles WHERE user_id = ? LIMIT 1',
    [userId],
  );
  return rows[0] || null;
}

export async function createIdentity({ name, email, passwordHash, role, profile }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [userResult] = await connection.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, role],
    );
    const userId = userResult.insertId;

    if (profile) {
      await connection.query(
        'INSERT INTO player_profiles (user_id, unique_player_id, mobile, in_game_name, game_uid) VALUES (?, ?, ?, ?, ?)',
        [userId, profile.uniquePlayerId, profile.mobile || null, profile.inGameName || null, profile.gameUid || null],
      );
    }

    await connection.commit();
    return { id: userId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateIdentityProfile(userId, updates) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (updates.name !== undefined) {
      await connection.query('UPDATE users SET name = ? WHERE id = ?', [updates.name, userId]);
    }

    const profileValues = [updates.mobile, updates.inGameName, updates.gameUid];
    if (profileValues.some((value) => value !== undefined)) {
      await connection.query(
        'UPDATE player_profiles SET mobile = COALESCE(?, mobile), in_game_name = COALESCE(?, in_game_name), game_uid = COALESCE(?, game_uid) WHERE user_id = ?',
        [...profileValues.map((value) => value ?? null), userId],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
