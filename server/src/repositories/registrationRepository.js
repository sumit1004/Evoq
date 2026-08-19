import { pool } from '../config/database.js';

export async function getRegistrationContext(tournamentId, teamId) {
  const [rows] = await pool.query(
    `SELECT t.id AS tournament_id, t.status AS tournament_status, t.entry_type, t.players_per_team, t.organizer_id,
            tm.id AS team_id, tm.owner_id, COUNT(all_members.user_id) AS member_count
     FROM tournaments t
     INNER JOIN teams tm ON tm.id = ?
     INNER JOIN team_members owner_members ON owner_members.team_id = tm.id AND owner_members.role = 'OWNER'
     INNER JOIN team_members all_members ON all_members.team_id = tm.id
     WHERE t.id = ?
     GROUP BY t.id, tm.id, tm.owner_id`,
    [teamId, tournamentId],
  );
  return rows[0] || null;
}

export async function insertRegistration(input) {
  const [result] = await pool.query(
    'INSERT INTO registrations (tournament_id, team_id, transaction_id, payment_screenshot_path) VALUES (?, ?, ?, ?)',
    [input.tournamentId, input.teamId, input.transactionId || null, input.paymentScreenshotPath || null],
  );
  return result.insertId;
}

const select = `SELECT r.id, r.tournament_id, r.team_id, r.status, r.transaction_id, r.payment_screenshot_path,
  r.submitted_at, r.verified_at, r.verified_by, r.rejection_reason, r.created_at, r.updated_at,
  t.name AS tournament_name, t.organizer_id, t.entry_type, teams.name AS team_name,
  users.id AS member_id, users.name AS member_name, users.email AS member_email, pp.unique_player_id`;

function registrationWhere(tournamentId, { status, search } = {}) {
  const clauses = ['r.tournament_id = ?']; const values = [tournamentId];
  if (status && ['PENDING', 'VERIFIED', 'REJECTED'].includes(status)) { clauses.push('r.status = ?'); values.push(status); }
  if (search?.trim()) { clauses.push('(teams.name LIKE ? OR users.name LIKE ? OR r.transaction_id LIKE ?)'); const term = `%${search.trim()}%`; values.push(term, term, term); }
  return { where: clauses.join(' AND '), values };
}

export async function listRegistrations(tournamentId, options = {}) {
  const { where, values } = registrationWhere(tournamentId, options);
  if (options.pagination) {
    const [ids] = await pool.query(`SELECT DISTINCT r.id, r.created_at FROM registrations r INNER JOIN teams ON teams.id = r.team_id INNER JOIN team_members ON team_members.team_id = teams.id INNER JOIN users ON users.id = team_members.user_id WHERE ${where} ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`, [...values, options.pagination.limit, options.pagination.offset]);
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await pool.query(`${select}
      FROM registrations r INNER JOIN tournaments t ON t.id = r.tournament_id
      INNER JOIN teams ON teams.id = r.team_id INNER JOIN team_members ON team_members.team_id = teams.id
      INNER JOIN users ON users.id = team_members.user_id INNER JOIN player_profiles pp ON pp.user_id = users.id
      WHERE r.id IN (${placeholders}) ORDER BY r.created_at DESC, users.id ASC`, ids.map((row) => row.id));
    return rows;
  }
  const [rows] = await pool.query(`${select}
    FROM registrations r INNER JOIN tournaments t ON t.id = r.tournament_id
    INNER JOIN teams ON teams.id = r.team_id INNER JOIN team_members ON team_members.team_id = teams.id
    INNER JOIN users ON users.id = team_members.user_id INNER JOIN player_profiles pp ON pp.user_id = users.id
    WHERE ${where} ORDER BY r.created_at DESC, users.id ASC`, values);
  return rows;
}

export async function countRegistrations(tournamentId, options = {}) { const { where, values } = registrationWhere(tournamentId, options); const [rows] = await pool.query(`SELECT COUNT(DISTINCT r.id) AS count FROM registrations r INNER JOIN teams ON teams.id = r.team_id INNER JOIN team_members ON team_members.team_id = teams.id INNER JOIN users ON users.id = team_members.user_id WHERE ${where}`, values); return Number(rows[0].count); }

export async function listPlayerRegistrations(tournamentId, userId) {
  const [rows] = await pool.query(`${select}
    FROM registrations r INNER JOIN tournaments t ON t.id = r.tournament_id
    INNER JOIN teams ON teams.id = r.team_id INNER JOIN team_members access_member ON access_member.team_id = teams.id AND access_member.user_id = ?
    INNER JOIN team_members ON team_members.team_id = teams.id INNER JOIN users ON users.id = team_members.user_id INNER JOIN player_profiles pp ON pp.user_id = users.id
    WHERE r.tournament_id = ? ORDER BY r.created_at DESC, users.id ASC`, [userId, tournamentId]);
  return rows;
}

export async function findRegistration(registrationId) {
  const [rows] = await pool.query(`${select}
    FROM registrations r INNER JOIN tournaments t ON t.id = r.tournament_id
    INNER JOIN teams ON teams.id = r.team_id INNER JOIN team_members ON team_members.team_id = teams.id
    INNER JOIN users ON users.id = team_members.user_id INNER JOIN player_profiles pp ON pp.user_id = users.id
    WHERE r.id = ? ORDER BY users.id ASC`, [registrationId]);
  return rows;
}

export async function findPlayerRegistration(registrationId, userId) {
  const [rows] = await pool.query(`${select}
    FROM registrations r INNER JOIN tournaments t ON t.id = r.tournament_id
    INNER JOIN teams ON teams.id = r.team_id INNER JOIN team_members access_member ON access_member.team_id = teams.id AND access_member.user_id = ?
    INNER JOIN team_members ON team_members.team_id = teams.id INNER JOIN users ON users.id = team_members.user_id INNER JOIN player_profiles pp ON pp.user_id = users.id
    WHERE r.id = ? ORDER BY users.id ASC`, [userId, registrationId]);
  return rows;
}

export async function reviewRegistration(registrationId, input) {
  const [result] = await pool.query("UPDATE registrations SET status = ?, verified_at = CASE WHEN ? = 'VERIFIED' THEN CURRENT_TIMESTAMP ELSE NULL END, verified_by = ?, rejection_reason = ? WHERE id = ? AND status = 'PENDING'", [input.status, input.status, input.verifierId, input.rejectionReason || null, registrationId]);
  return result.affectedRows;
}

export async function findRegistrationFile(registrationId) {
  const [rows] = await pool.query('SELECT r.payment_screenshot_path, r.tournament_id, t.organizer_id FROM registrations r INNER JOIN tournaments t ON t.id = r.tournament_id WHERE r.id = ?', [registrationId]);
  return rows[0] || null;
}
