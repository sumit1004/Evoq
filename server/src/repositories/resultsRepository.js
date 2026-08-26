import { pool } from '../config/database.js';

export async function getMatchContext(matchId) { const [rows] = await pool.query(`SELECT m.id, m.group_id, m.status, g.round_id, r.tournament_id, t.organizer_id, t.status AS tournament_status FROM matches m JOIN \`groups\` g ON g.id = m.group_id JOIN rounds r ON r.id = g.round_id JOIN tournaments t ON t.id = r.tournament_id WHERE m.id = ?`, [matchId]); return rows[0] || null; }
export async function getGroupContext(groupId) { const [rows] = await pool.query('SELECT g.id, g.round_id, r.tournament_id, r.status, t.organizer_id, t.status AS tournament_status FROM `groups` g JOIN rounds r ON r.id = g.round_id JOIN tournaments t ON t.id = r.tournament_id WHERE g.id = ?', [groupId]); return rows[0] || null; }
export async function getTournamentContext(tournamentId) { const [rows] = await pool.query('SELECT id, organizer_id, status FROM tournaments WHERE id = ?', [tournamentId]); return rows[0] || null; }
export async function isPlayerAssignedToGroup(groupId, userId) { const [rows] = await pool.query('SELECT 1 FROM group_teams gt JOIN team_members tm ON tm.team_id = gt.team_id WHERE gt.group_id = ? AND tm.user_id = ? LIMIT 1', [groupId, userId]); return Boolean(rows[0]); }
export async function isPlayerAssignedToRound(roundId, userId) { const [rows] = await pool.query('SELECT 1 FROM group_teams gt JOIN `groups` g ON g.id = gt.group_id JOIN team_members tm ON tm.team_id = gt.team_id WHERE g.round_id = ? AND tm.user_id = ? LIMIT 1', [roundId, userId]); return Boolean(rows[0]); }
export async function isPlayerAssignedToTournament(tournamentId, userId) { const [rows] = await pool.query('SELECT 1 FROM group_teams gt JOIN `groups` g ON g.id = gt.group_id JOIN rounds r ON r.id = g.round_id JOIN team_members tm ON tm.team_id = gt.team_id WHERE r.tournament_id = ? AND tm.user_id = ? LIMIT 1', [tournamentId, userId]); return Boolean(rows[0]); }
export async function listMatchResults(matchId) { const [rows] = await pool.query(`SELECT mr.id, mr.match_id, mr.team_id, t.name AS team_name, mr.points, mr.kills, mr.placement, mr.result_text, mr.media_path, mr.uploaded_by, mr.created_at, mr.updated_at FROM match_results mr JOIN teams t ON t.id = mr.team_id WHERE mr.match_id = ? ORDER BY mr.points DESC, mr.kills DESC, mr.placement IS NULL, mr.placement ASC, mr.team_id`, [matchId]); return rows; }
export async function findResult(matchId, teamId) { const [rows] = await pool.query('SELECT id, match_id, team_id, points, kills, placement, result_text, media_path FROM match_results WHERE match_id = ? AND team_id = ?', [matchId, teamId]); return rows[0] || null; }
export async function insertResult(input) { const [result] = await pool.query('INSERT INTO match_results (match_id, team_id, points, kills, placement, result_text, media_path, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [input.matchId, input.teamId, input.points, input.kills, input.placement || null, input.resultText || null, input.mediaPath || null, input.uploadedBy]); return result.insertId; }
export async function replaceLeaderboard(matchId, entries) { const connection = await pool.getConnection(); try { await connection.beginTransaction(); await connection.query('DELETE FROM leaderboard_entries WHERE match_id = ?', [matchId]); if (entries.length) await connection.query('INSERT INTO leaderboard_entries (match_id, team_id, points, kills, `rank`) VALUES ?', [entries.map((entry) => [matchId, entry.teamId, entry.points, entry.kills, entry.rank])]); await connection.commit(); } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); } }
export async function listMatchLeaderboard(matchId) { const [rows] = await pool.query('SELECT le.match_id, le.team_id, t.name AS team_name, le.points, le.kills, le.rank FROM leaderboard_entries le JOIN teams t ON t.id = le.team_id WHERE le.match_id = ? ORDER BY le.rank', [matchId]); return rows; }
export async function listGroupLeaderboard(groupId) { const [rows] = await pool.query('SELECT m.group_id, le.team_id, t.name AS team_name, SUM(le.points) AS points, SUM(le.kills) AS kills, COUNT(DISTINCT m.id) AS matches_played FROM matches m JOIN leaderboard_entries le ON le.match_id = m.id JOIN teams t ON t.id = le.team_id WHERE m.group_id = ? GROUP BY m.group_id, le.team_id, t.name ORDER BY points DESC, kills DESC, team_id', [groupId]); return rows; }
export async function listRoundLeaderboard(roundId) { const [rows] = await pool.query('SELECT r.id AS round_id, le.team_id, t.name AS team_name, SUM(le.points) AS points, SUM(le.kills) AS kills, COUNT(DISTINCT m.id) AS matches_played FROM rounds r JOIN `groups` g ON g.round_id = r.id JOIN matches m ON m.group_id = g.id JOIN leaderboard_entries le ON le.match_id = m.id JOIN teams t ON t.id = le.team_id WHERE r.id = ? GROUP BY r.id, le.team_id, t.name ORDER BY points DESC, kills DESC, team_id', [roundId]); return rows; }
export async function listTournamentResults(tournamentId) { const [rows] = await pool.query('SELECT m.id AS match_id, m.name AS match_name, g.id AS group_id, g.name AS group_name, r.id AS round_id, r.name AS round_name, mr.team_id, t.name AS team_name, mr.points, mr.kills, mr.placement, mr.result_text, mr.created_at FROM match_results mr JOIN matches m ON m.id = mr.match_id JOIN `groups` g ON g.id = m.group_id JOIN rounds r ON r.id = g.round_id JOIN teams t ON t.id = mr.team_id WHERE r.tournament_id = ? ORDER BY r.round_number, g.id, m.match_number, mr.points DESC', [tournamentId]); return rows; }
export async function listTournamentLeaderboard(tournamentId) { const [rows] = await pool.query('SELECT r.tournament_id, le.team_id, t.name AS team_name, SUM(le.points) AS points, SUM(le.kills) AS kills, COUNT(DISTINCT m.id) AS matches_played FROM rounds r JOIN `groups` g ON g.round_id = r.id JOIN matches m ON m.group_id = g.id JOIN leaderboard_entries le ON le.match_id = m.id JOIN teams t ON t.id = le.team_id WHERE r.tournament_id = ? GROUP BY r.tournament_id, le.team_id, t.name ORDER BY points DESC, kills DESC, team_id', [tournamentId]); return rows; }
export async function listQualifications(roundId) { const [rows] = await pool.query('SELECT q.round_id, q.team_id, t.name AS team_name, q.source_group_id, g.name AS source_group_name, q.rank_at_qualification, q.selected_by, q.selected_at FROM qualifications q JOIN teams t ON t.id = q.team_id LEFT JOIN `groups` g ON g.id = q.source_group_id WHERE q.round_id = ? ORDER BY COALESCE(q.rank_at_qualification, 999), t.name', [roundId]); return rows; }
export async function getRoundContext(roundId) { const [rows] = await pool.query('SELECT r.id, r.tournament_id, r.round_number, r.status, r.is_locked, r.assignment_status, r.qualifications_finalized_at, t.organizer_id, t.status AS tournament_status FROM rounds r JOIN tournaments t ON t.id = r.tournament_id WHERE r.id = ?', [roundId]); return rows[0] || null; }
export async function getTeamInRound(roundId, teamId) { const [rows] = await pool.query('SELECT gt.team_id, gt.group_id FROM group_teams gt JOIN `groups` g ON g.id = gt.group_id WHERE g.round_id = ? AND gt.team_id = ?', [roundId, teamId]); return rows[0] || null; }
export async function getTeamInMatchGroup(matchId, teamId) { const [rows] = await pool.query('SELECT gt.team_id, gt.group_id FROM group_teams gt JOIN matches m ON m.group_id = gt.group_id WHERE m.id = ? AND gt.team_id = ?', [matchId, teamId]); return rows[0] || null; }
export async function insertQualification(input) { const [result] = await pool.query('INSERT INTO qualifications (round_id, team_id, source_group_id, rank_at_qualification, selected_by) VALUES (?, ?, ?, ?, ?)', [input.roundId, input.teamId, input.sourceGroupId || null, input.rankAtQualification || null, input.selectedBy]); return result.insertId; }
export async function deleteQualification(roundId, teamId) { await pool.query('DELETE FROM qualifications WHERE round_id = ? AND team_id = ?', [roundId, teamId]); }
export async function countQualifications(roundId) { const [rows] = await pool.query('SELECT COUNT(*) AS count FROM qualifications WHERE round_id = ?', [roundId]); return Number(rows[0].count); }

export async function finalizeQualificationsBatch(roundId, selections, userId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rounds] = await connection.query('SELECT id, tournament_id, status FROM rounds WHERE id = ? FOR UPDATE', [roundId]);
    if (!rounds[0]) throw new Error('Round not found');

    // Remove existing qualifications for this round
    await connection.query('DELETE FROM qualifications WHERE round_id = ?', [roundId]);

    // Insert new batch
    if (selections && selections.length > 0) {
      const values = selections.map((s) => [
        roundId,
        s.teamId,
        s.sourceGroupId || null,
        s.rankAtQualification || null,
        userId,
      ]);
      await connection.query(
        'INSERT INTO qualifications (round_id, team_id, source_group_id, rank_at_qualification, selected_by) VALUES ?',
        [values]
      );
    }

    // Set finalized timestamp
    await connection.query(
      'UPDATE rounds SET qualifications_finalized_at = CURRENT_TIMESTAMP WHERE id = ?',
      [roundId]
    );

    await connection.commit();
    return listQualifications(roundId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function reopenRoundQualifications(roundId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rounds] = await connection.query('SELECT id, tournament_id, round_number FROM rounds WHERE id = ? FOR UPDATE', [roundId]);
    if (!rounds[0]) throw new Error('Round not found');

    // Check if next round already exists and has started
    const [nextRounds] = await connection.query(
      'SELECT id, status FROM rounds WHERE tournament_id = ? AND round_number = ?',
      [rounds[0].tournament_id, Number(rounds[0].round_number) + 1]
    );
    if (nextRounds[0] && nextRounds[0].status !== 'NOT_STARTED') {
      const error = new Error('Cannot reopen qualification because next round has already started');
      error.code = 'NEXT_ROUND_STARTED';
      throw error;
    }

    await connection.query(
      'UPDATE rounds SET qualifications_finalized_at = NULL WHERE id = ?',
      [roundId]
    );

    await connection.commit();
    return listQualifications(roundId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

