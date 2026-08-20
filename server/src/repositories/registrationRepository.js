import { pool } from '../config/database.js';

export async function getRegistrationContext(tournamentId, teamId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT t.id AS tournament_id, t.status AS tournament_status, t.entry_type, t.entry_fee, t.players_per_team, t.organizer_id, t.max_teams, t.payment_method,
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

export async function insertRegistration(input, connection = pool) {
  const [result] = await connection.query(
    'INSERT INTO registrations (tournament_id, team_id) VALUES (?, ?)',
    [input.tournamentId, input.teamId],
  );
  return result.insertId;
}

const select = `SELECT r.id, r.tournament_id, r.team_id, r.status,
  r.submitted_at, r.verified_at, r.verified_by, r.rejection_reason, r.rejected_at, r.rejected_by, r.created_at, r.updated_at,
  p.status AS payment_status, p.amount AS payment_amount, p.transaction_reference, p.proof_url, p.provider AS payment_provider,
  p.provider_order_id, p.provider_payment_id, p.currency AS payment_currency, p.captured_at AS payment_captured_at,
  t.name AS tournament_name, t.game AS tournament_game, t.organizer_id, t.entry_type, t.status AS tournament_status, teams.name AS team_name,
  rms.user_id AS member_id, rms.player_name AS member_name, rms.email AS member_email, rms.unique_player_id, rms.mobile AS member_mobile, rms.in_game_name AS member_ign, rms.game_uid AS member_uid`;

function registrationWhere(tournamentId, { status, search } = {}) {
  const clauses = ['r.tournament_id = ?'];
  const values = [tournamentId];
  if (status && ['PENDING', 'VERIFIED', 'REJECTED', 'CANCELLED'].includes(status)) {
    clauses.push('r.status = ?');
    values.push(status);
  }
  if (search?.trim()) {
    clauses.push('(teams.name LIKE ? OR rms.player_name LIKE ? OR p.transaction_reference LIKE ?)');
    const term = `%${search.trim()}%`;
    values.push(term, term, term);
  }
  return { where: clauses.join(' AND '), values };
}

export async function listRegistrations(tournamentId, options = {}) {
  const { where, values } = registrationWhere(tournamentId, options);
  if (options.pagination) {
    const [ids] = await pool.query(
      `SELECT DISTINCT r.id, r.created_at
       FROM registrations r
       INNER JOIN teams ON teams.id = r.team_id
       INNER JOIN registration_member_snapshots rms ON rms.registration_id = r.id
       LEFT JOIN payments p ON p.registration_id = r.id
       WHERE ${where}
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT ? OFFSET ?`,
      [...values, options.pagination.limit, options.pagination.offset],
    );
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await pool.query(
      `${select}
       FROM registrations r
       INNER JOIN tournaments t ON t.id = r.tournament_id
       INNER JOIN teams ON teams.id = r.team_id
       INNER JOIN registration_member_snapshots rms ON rms.registration_id = r.id
       LEFT JOIN payments p ON p.registration_id = r.id
       WHERE r.id IN (${placeholders})
       ORDER BY r.created_at DESC, rms.user_id ASC`,
      ids.map((row) => row.id),
    );
    return rows;
  }
  const [rows] = await pool.query(
    `${select}
     FROM registrations r
     INNER JOIN tournaments t ON t.id = r.tournament_id
     INNER JOIN teams ON teams.id = r.team_id
     INNER JOIN registration_member_snapshots rms ON rms.registration_id = r.id
     LEFT JOIN payments p ON p.registration_id = r.id
     WHERE ${where}
     ORDER BY r.created_at DESC, rms.user_id ASC`,
    values,
  );
  return rows;
}

export async function countRegistrations(tournamentId, options = {}) {
  const { where, values } = registrationWhere(tournamentId, options);
  const [rows] = await pool.query(
    `SELECT COUNT(DISTINCT r.id) AS count
     FROM registrations r
     INNER JOIN teams ON teams.id = r.team_id
     INNER JOIN registration_member_snapshots rms ON rms.registration_id = r.id
     LEFT JOIN payments p ON p.registration_id = r.id
     WHERE ${where}`,
    values,
  );
  return Number(rows[0].count);
}

export async function listPlayerRegistrations(tournamentId, userId) {
  const [rows] = await pool.query(
    `${select}
     FROM registrations r
     INNER JOIN tournaments t ON t.id = r.tournament_id
     INNER JOIN teams ON teams.id = r.team_id
     INNER JOIN team_members access_member ON access_member.team_id = teams.id AND access_member.user_id = ?
     INNER JOIN registration_member_snapshots rms ON rms.registration_id = r.id
     LEFT JOIN payments p ON p.registration_id = r.id
     WHERE r.tournament_id = ?
     ORDER BY r.created_at DESC, rms.user_id ASC`,
    [userId, tournamentId],
  );
  return rows;
}

export async function findRegistration(registrationId, connection = pool) {
  const [rows] = await connection.query(
    `${select}
     FROM registrations r
     INNER JOIN tournaments t ON t.id = r.tournament_id
     INNER JOIN teams ON teams.id = r.team_id
     INNER JOIN registration_member_snapshots rms ON rms.registration_id = r.id
     LEFT JOIN payments p ON p.registration_id = r.id
     WHERE r.id = ?
     ORDER BY rms.user_id ASC`,
    [registrationId],
  );
  return rows;
}

export async function findPlayerRegistration(registrationId, userId) {
  const [rows] = await pool.query(
    `${select}
     FROM registrations r
     INNER JOIN tournaments t ON t.id = r.tournament_id
     INNER JOIN teams ON teams.id = r.team_id
     INNER JOIN team_members access_member ON access_member.team_id = teams.id AND access_member.user_id = ?
     INNER JOIN registration_member_snapshots rms ON rms.registration_id = r.id
     LEFT JOIN payments p ON p.registration_id = r.id
     WHERE r.id = ?
     ORDER BY rms.user_id ASC`,
    [userId, registrationId],
  );
  return rows;
}

export async function listTeamMembersWithProfiles(teamId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT u.id AS user_id, u.name AS player_name, u.email, pp.unique_player_id, pp.mobile, pp.in_game_name, pp.game_uid
     FROM team_members tm
     INNER JOIN users u ON u.id = tm.user_id
     LEFT JOIN player_profiles pp ON pp.user_id = u.id
     WHERE tm.team_id = ?`,
    [teamId]
  );
  return rows;
}

export async function insertRegistrationMemberSnapshots(registrationId, members, connection = pool) {
  for (const member of members) {
    await connection.query(
      `INSERT INTO registration_member_snapshots 
       (registration_id, user_id, unique_player_id, player_name, email, mobile, in_game_name, game_uid)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        registrationId,
        member.user_id,
        member.unique_player_id,
        member.player_name,
        member.email,
        member.mobile || null,
        member.in_game_name || null,
        member.game_uid || null
      ]
    );
  }
}

export async function reviewRegistration(registrationId, input, connection = pool) {
  const [result] = await connection.query(
    `UPDATE registrations
     SET status = ?,
         verified_at = CASE WHEN ? = 'VERIFIED' THEN CURRENT_TIMESTAMP ELSE NULL END,
         verified_by = CASE WHEN ? = 'VERIFIED' THEN ? ELSE NULL END,
         rejected_at = CASE WHEN ? = 'REJECTED' THEN CURRENT_TIMESTAMP ELSE NULL END,
         rejected_by = CASE WHEN ? = 'REJECTED' THEN ? ELSE NULL END,
         rejection_reason = CASE WHEN ? = 'REJECTED' THEN ? ELSE NULL END
     WHERE id = ? AND status = 'PENDING'`,
    [
      input.status,
      input.status,
      input.status,
      input.verifierId,
      input.status,
      input.status,
      input.verifierId,
      input.status,
      input.rejectionReason || null,
      registrationId,
    ],
  );
  return result.affectedRows;
}

export async function findRegistrationFile(registrationId) {
  const [rows] = await pool.query(
    `SELECT p.proof_url AS payment_screenshot_path, r.tournament_id, t.organizer_id
     FROM registrations r
     INNER JOIN tournaments t ON t.id = r.tournament_id
     LEFT JOIN payments p ON p.registration_id = r.id
     WHERE r.id = ?`,
    [registrationId],
  );
  return rows[0] || null;
}

export async function getTournamentRegistrationCountForUpdate(tournamentId, connection) {
  const [rows] = await connection.query(
    "SELECT COUNT(id) AS registered_count FROM registrations WHERE tournament_id = ? AND status IN ('PENDING', 'VERIFIED') FOR UPDATE",
    [tournamentId],
  );
  return Number(rows[0].registered_count);
}
