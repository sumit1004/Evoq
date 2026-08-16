import { pool } from '../config/database.js';

function placeholders(count) {
  return Array.from({ length: count }, () => '?').join(', ');
}

export async function resolvePlayerIds(playerIds) {
  if (playerIds.length === 0) return [];
  const [rows] = await pool.query(
    `SELECT u.id, pp.unique_player_id
     FROM users u
     INNER JOIN player_profiles pp ON pp.user_id = u.id
     WHERE u.role = 'PLAYER' AND pp.unique_player_id IN (${placeholders(playerIds.length)})`,
    playerIds,
  );
  return rows;
}

export async function listTeamsForUser(userId) {
  const [rows] = await pool.query(
    `SELECT t.id, t.name, t.owner_id, owner.name AS owner_name,
            tm.role AS member_role, member.id AS member_id, member.name AS member_name,
            member.email AS member_email, pp.unique_player_id
     FROM team_members tm
     INNER JOIN teams t ON t.id = tm.team_id
     INNER JOIN users owner ON owner.id = t.owner_id
     INNER JOIN team_members all_members ON all_members.team_id = t.id
     INNER JOIN users member ON member.id = all_members.user_id
     INNER JOIN player_profiles pp ON pp.user_id = member.id
     WHERE tm.user_id = ?
     ORDER BY t.id DESC, member.id ASC`,
    [userId],
  );
  return rows;
}

export async function findTeamForUser(teamId, userId) {
  const [rows] = await pool.query(
    `SELECT t.id, t.name, t.owner_id, owner.name AS owner_name,
            member.id AS member_id, member.name AS member_name,
            member.email AS member_email, tm.role AS member_role,
            pp.unique_player_id
     FROM teams t
     INNER JOIN users owner ON owner.id = t.owner_id
     INNER JOIN team_members access_member ON access_member.team_id = t.id AND access_member.user_id = ?
     INNER JOIN team_members tm ON tm.team_id = t.id
     INNER JOIN users member ON member.id = tm.user_id
     INNER JOIN player_profiles pp ON pp.user_id = member.id
     WHERE t.id = ?
     ORDER BY member.id ASC`,
    [userId, teamId],
  );
  return rows;
}

export async function getTeamOwner(teamId) {
  const [rows] = await pool.query('SELECT id, owner_id, name FROM teams WHERE id = ? LIMIT 1', [teamId]);
  return rows[0] || null;
}

export async function createTeam({ name, ownerId, memberIds }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [teamResult] = await connection.query(
      'INSERT INTO teams (name, owner_id) VALUES (?, ?)',
      [name, ownerId],
    );
    const teamId = teamResult.insertId;
    const members = [[teamId, ownerId, 'OWNER'], ...memberIds.filter((id) => id !== ownerId).map((id) => [teamId, id, 'MEMBER'])];
    await connection.query(
      'INSERT INTO team_members (team_id, user_id, role) VALUES ?',
      [members],
    );
    await connection.commit();
    return teamId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteTeam(teamId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query('DELETE FROM teams WHERE id = ?', [teamId]);
    await connection.commit();
    return result.affectedRows > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
