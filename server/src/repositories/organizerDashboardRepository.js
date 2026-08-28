import { pool } from '../config/database.js';

export async function getMetrics(userId) {
  const isManaged = "(t.organizer_id = ? OR t.id IN (SELECT tournament_id FROM tournament_staff WHERE user_id = ? AND status = 'ACTIVE'))";
  const [rows] = await pool.query(`SELECT
    (SELECT COUNT(t.id) FROM tournaments t WHERE ${isManaged} AND t.status <> 'DRAFT' AND t.status <> 'COMPLETED') AS active,
    (SELECT COUNT(t.id) FROM tournaments t WHERE ${isManaged} AND t.status = 'LIVE') AS live,
    (SELECT COUNT(t.id) FROM tournaments t WHERE ${isManaged} AND t.status IN ('DRAFT', 'REGISTRATION_OPEN') AND (t.registration_start_at > NOW() OR t.status = 'REGISTRATION_OPEN')) AS upcoming,
    (SELECT COUNT(t.id) FROM tournaments t WHERE ${isManaged} AND t.status = 'COMPLETED') AS completed,
    (SELECT COUNT(r.id) FROM registrations r JOIN tournaments t ON t.id = r.tournament_id WHERE ${isManaged} AND r.status = 'PENDING') AS pending_reviews,
    (SELECT COUNT(r.id) FROM registrations r JOIN tournaments t ON t.id = r.tournament_id WHERE ${isManaged} AND r.status = 'VERIFIED') AS total_teams
  `, [userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId]);
  return rows[0];
}

export async function getActionRequired(userId) {
  const isManaged = "(t.organizer_id = ? OR t.id IN (SELECT tournament_id FROM tournament_staff WHERE user_id = ? AND status = 'ACTIVE'))";
  // Pending registrations grouped by tournament
  const [pendingRegs] = await pool.query(`
    SELECT t.id AS tournament_id, t.name AS tournament_name, COUNT(r.id) AS pending_count 
    FROM tournaments t 
    JOIN registrations r ON r.tournament_id = t.id 
    WHERE ${isManaged} AND r.status = 'PENDING' 
    GROUP BY t.id, t.name
  `, [userId, userId]);

  // Groups that have all matches COMPLETED but group status is not COMPLETED
  const [pendingGroups] = await pool.query(`
    SELECT g.id AS group_id, g.name AS group_name, rd.id AS round_id, rd.name AS round_name, t.id AS tournament_id, t.name AS tournament_name
    FROM \`groups\` g
    JOIN rounds rd ON rd.id = g.round_id
    JOIN tournaments t ON t.id = rd.tournament_id
    WHERE ${isManaged} AND g.status <> 'COMPLETED'
    AND EXISTS (SELECT 1 FROM matches m WHERE m.group_id = g.id)
    AND NOT EXISTS (SELECT 1 FROM matches m WHERE m.group_id = g.id AND m.status <> 'COMPLETED')
  `, [userId, userId]);
  
  return { pendingRegs, pendingGroups };
}

export async function listMyTournaments(userId) {
  const isManaged = "(t.organizer_id = ? OR t.id IN (SELECT tournament_id FROM tournament_staff WHERE user_id = ? AND status = 'ACTIVE'))";
  const [rows] = await pool.query(`
    SELECT t.id, t.name, t.status, t.tournament_date, t.registration_end_at,
    (SELECT COUNT(id) FROM registrations r WHERE r.tournament_id = t.id) AS total_registrations,
    (SELECT COUNT(id) FROM registrations r WHERE r.tournament_id = t.id AND r.status = 'VERIFIED') AS verified_registrations,
    (SELECT COUNT(id) FROM registrations r WHERE r.tournament_id = t.id AND r.status = 'PENDING') AS pending_registrations,
    (SELECT rd.name FROM rounds rd WHERE rd.tournament_id = t.id ORDER BY rd.round_number DESC LIMIT 1) AS current_round,
    (SELECT COUNT(g.id) FROM \`groups\` g JOIN rounds rd ON rd.id = g.round_id WHERE rd.tournament_id = t.id AND rd.id = (SELECT r2.id FROM rounds r2 WHERE r2.tournament_id = t.id ORDER BY r2.round_number DESC LIMIT 1)) AS current_groups
    FROM tournaments t
    WHERE ${isManaged}
    ORDER BY t.status = 'LIVE' DESC, t.created_at DESC
  `, [userId, userId]);
  return rows;
}

export async function listUpcomingDeadlines(userId) {
  const isManaged = "(t.organizer_id = ? OR t.id IN (SELECT tournament_id FROM tournament_staff WHERE user_id = ? AND status = 'ACTIVE'))";
  const [rows] = await pool.query(`
    SELECT 'REGISTRATION_CLOSE' AS type, t.id AS tournament_id, t.name AS tournament_name, t.registration_end_at AS date
    FROM tournaments t
    WHERE ${isManaged} AND t.status = 'REGISTRATION_OPEN' AND t.registration_end_at > NOW()
    UNION
    SELECT 'ROUND_START' AS type, t.id AS tournament_id, t.name AS tournament_name, rd.started_at AS date
    FROM rounds rd
    JOIN tournaments t ON t.id = rd.tournament_id
    WHERE ${isManaged} AND rd.status = 'NOT_STARTED' AND rd.started_at > NOW()
    ORDER BY date ASC
    LIMIT 5
  `, [userId, userId, userId, userId]);
  return rows;
}

export async function getLiveOperations(userId) {
  const isManaged = "(t.organizer_id = ? OR t.id IN (SELECT tournament_id FROM tournament_staff WHERE user_id = ? AND status = 'ACTIVE'))";
  const [rows] = await pool.query(`
    SELECT t.id AS tournament_id, t.name AS tournament_name,
    (SELECT rd.name FROM rounds rd WHERE rd.tournament_id = t.id AND rd.status = 'IN_PROGRESS' ORDER BY rd.round_number DESC LIMIT 1) AS round_name,
    (SELECT COUNT(g.id) FROM \`groups\` g JOIN rounds rd ON rd.id = g.round_id WHERE rd.tournament_id = t.id AND rd.status = 'IN_PROGRESS') AS active_groups,
    (SELECT COUNT(tm.user_id) FROM team_members tm JOIN registrations r ON r.team_id = tm.team_id WHERE r.tournament_id = t.id AND r.status = 'VERIFIED') AS verified_players,
    (SELECT COUNT(m.id) FROM matches m JOIN \`groups\` g ON g.id = m.group_id JOIN rounds rd ON rd.id = g.round_id WHERE rd.tournament_id = t.id AND rd.status = 'IN_PROGRESS' AND m.status = 'COMPLETED') AS completed_matches,
    (SELECT COUNT(m.id) FROM matches m JOIN \`groups\` g ON g.id = m.group_id JOIN rounds rd ON rd.id = g.round_id WHERE rd.tournament_id = t.id AND rd.status = 'IN_PROGRESS' AND m.status = 'LIVE') AS live_matches,
    (SELECT COUNT(m.id) FROM matches m JOIN \`groups\` g ON g.id = m.group_id JOIN rounds rd ON rd.id = g.round_id WHERE rd.tournament_id = t.id AND rd.status = 'IN_PROGRESS' AND m.status = 'SCHEDULED') AS pending_matches
    FROM tournaments t
    WHERE ${isManaged} AND t.status = 'LIVE'
    ORDER BY t.created_at DESC
  `, [userId, userId]);
  return rows;
}
