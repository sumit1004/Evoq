import { pool } from '../config/database.js';

export async function getTournamentForCompletion(tournamentId, connection = pool) { const [rows] = await connection.query('SELECT id, organizer_id, name, status, completed_at FROM tournaments WHERE id = ? FOR UPDATE', [tournamentId]); return rows[0] || null; }
export async function getFinalRound(tournamentId, connection = pool) { const [rows] = await connection.query('SELECT id, round_number, name, status FROM rounds WHERE tournament_id = ? ORDER BY round_number DESC LIMIT 1', [tournamentId]); return rows[0] || null; }
export async function countIncompleteGroups(roundId, connection = pool) { const [rows] = await connection.query("SELECT COUNT(*) AS count FROM `groups` WHERE round_id = ? AND status <> 'COMPLETED'", [roundId]); return Number(rows[0].count); }
export async function countIncompleteMatches(roundId, connection = pool) { const [rows] = await connection.query("SELECT COUNT(*) AS count FROM matches m JOIN `groups` g ON g.id = m.group_id WHERE g.round_id = ? AND m.status <> 'COMPLETED'", [roundId]); return Number(rows[0].count); }
export async function countQualifications(roundId, connection = pool) { const [rows] = await connection.query('SELECT COUNT(*) AS count FROM qualifications WHERE round_id = ?', [roundId]); return Number(rows[0].count); }
export async function getRegistrationCount(tournamentId, connection = pool) { const [rows] = await connection.query('SELECT COUNT(*) AS count FROM registrations WHERE tournament_id = ?', [tournamentId]); return Number(rows[0].count); }
export async function getFinalLeaderboard(tournamentId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT 
       le.team_id, 
       t.name AS team_name, 
       SUM(le.points) AS points, 
       SUM(le.kills) AS kills, 
       MIN(mr.placement) AS placement, 
       COUNT(DISTINCT m.id) AS matches_played 
     FROM rounds r 
     JOIN \`groups\` g ON g.round_id = r.id 
     JOIN matches m ON m.group_id = g.id 
     JOIN leaderboard_entries le ON le.match_id = m.id 
     JOIN teams t ON t.id = le.team_id 
     LEFT JOIN match_results mr ON mr.match_id = m.id AND mr.team_id = le.team_id 
     WHERE r.tournament_id = ? 
     GROUP BY le.team_id, t.name 
     ORDER BY points DESC, kills DESC, le.team_id`,
    [tournamentId]
  );
  return rows.map((row, index) => ({
    rank: index + 1,
    teamId: row.team_id,
    teamName: row.team_name,
    points: Number(row.points || 0),
    kills: Number(row.kills || 0),
    placement: row.placement != null ? Number(row.placement) : null,
    matchesPlayed: Number(row.matches_played || 0),
  }));
}
export async function getQualifications(tournamentId, connection = pool) { const [rows] = await connection.query('SELECT q.round_id, q.team_id, t.name AS team_name, q.source_group_id, q.selected_at FROM qualifications q JOIN rounds r ON r.id = q.round_id JOIN teams t ON t.id = q.team_id WHERE r.tournament_id = ? ORDER BY r.round_number, t.name', [tournamentId]); return rows.map((row) => ({ roundId: row.round_id, teamId: row.team_id, teamName: row.team_name, sourceGroupId: row.source_group_id, selectedAt: row.selected_at })); }
export async function getResultMediaPaths(tournamentId, connection = pool) { const [rows] = await connection.query('SELECT mr.media_path FROM match_results mr JOIN matches m ON m.id = mr.match_id JOIN `groups` g ON g.id = m.group_id JOIN rounds r ON r.id = g.round_id WHERE r.tournament_id = ? AND mr.media_path IS NOT NULL', [tournamentId]); return rows.map((row) => row.media_path); }
export async function getTournamentAnnouncements(tournamentId, connection = pool) {
  const [rows] = await connection.query(
    'SELECT a.id, a.message, a.created_by, u.name AS creator_name, a.created_at FROM announcements a JOIN users u ON u.id = a.created_by WHERE a.tournament_id = ? ORDER BY a.created_at ASC',
    [tournamentId]
  );
  return rows.map((r) => ({
    id: r.id,
    message: r.message,
    createdBy: r.created_by,
    creatorName: r.creator_name,
    createdAt: r.created_at,
  }));
}
export async function insertArchive(input, connection) { const [result] = await connection.query('INSERT INTO tournament_archives (tournament_id, tournament_name, completed_at, registration_count, final_leaderboard_json, qualified_teams_json, winners_json, summary_json) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)', [input.tournamentId, input.tournamentName, input.registrationCount, JSON.stringify(input.finalLeaderboard), JSON.stringify(input.qualifiedTeams), JSON.stringify(input.winners), JSON.stringify(input.summary)]); return result.insertId; }
export async function markCompletedAndCleanup(tournamentId, connection) {
  await connection.query('UPDATE tournaments SET status = \'COMPLETED\', completed_at = CURRENT_TIMESTAMP WHERE id = ?', [tournamentId]);
  await connection.query('DELETE FROM chat_messages WHERE group_id IN (SELECT id FROM `groups` WHERE round_id IN (SELECT id FROM rounds WHERE tournament_id = ?))', [tournamentId]);
  await connection.query('DELETE FROM notifications WHERE tournament_id = ?', [tournamentId]);
  await connection.query("UPDATE `groups` g JOIN rounds r ON r.id = g.round_id SET g.room_id = NULL, g.room_password = NULL WHERE r.tournament_id = ?", [tournamentId]);
}
export async function listArchives(connection = pool) { const [rows] = await connection.query('SELECT id, tournament_id, tournament_name, completed_at, registration_count, final_leaderboard_json, qualified_teams_json, winners_json, summary_json, created_at FROM tournament_archives ORDER BY completed_at DESC'); return rows; }
export async function findArchive(historyId, connection = pool) { const [rows] = await connection.query('SELECT a.id, a.tournament_id, t.organizer_id, a.tournament_name, a.completed_at, a.registration_count, a.final_leaderboard_json, a.qualified_teams_json, a.winners_json, a.summary_json, a.created_at FROM tournament_archives a JOIN tournaments t ON t.id = a.tournament_id WHERE a.id = ?', [historyId]); return rows[0] || null; }
export async function findArchiveByTournamentId(tournamentId, connection = pool) { const [rows] = await connection.query('SELECT a.id, a.tournament_id, t.organizer_id, a.tournament_name, a.completed_at, a.registration_count, a.final_leaderboard_json, a.qualified_teams_json, a.winners_json, a.summary_json, a.created_at FROM tournament_archives a JOIN tournaments t ON t.id = a.tournament_id WHERE a.tournament_id = ?', [tournamentId]); return rows[0] || null; }
export async function deleteArchive(historyId, connection = pool) { await connection.query('DELETE FROM tournament_archives WHERE id = ?', [historyId]); }
export async function insertCleanupJobs(tournamentId, paths, connection = pool) { if (paths.length) await connection.query('INSERT INTO archive_cleanup_jobs (tournament_id, file_path) VALUES ?', [paths.map((filePath) => [tournamentId, filePath])]); }
export async function markCleanupFile(tournamentId, filePath, status, errorMessage = null) { await pool.query('UPDATE archive_cleanup_jobs SET status = ?, attempts = attempts + 1, last_error = ? WHERE tournament_id = ? AND file_path = ?', [status, errorMessage, tournamentId, filePath]); }
