import { pool } from '../config/database.js';

export async function findScoringConfig(tournamentId) {
  const [rows] = await pool.query(
    'SELECT tournament_id, scoring_mode, kill_points_per_kill, created_at, updated_at FROM tournament_scoring_configs WHERE tournament_id = ?',
    [tournamentId]
  );
  return rows[0] || null;
}

export async function listPositionPoints(tournamentId) {
  const [rows] = await pool.query(
    'SELECT position, points FROM tournament_position_points WHERE tournament_id = ? ORDER BY position ASC',
    [tournamentId]
  );
  return rows;
}

export async function saveScoringConfig(tournamentId, { scoringMode, killPointsPerKill, positionPoints = [] }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      'INSERT INTO tournament_scoring_configs (tournament_id, scoring_mode, kill_points_per_kill) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE scoring_mode = VALUES(scoring_mode), kill_points_per_kill = VALUES(kill_points_per_kill)',
      [tournamentId, scoringMode, killPointsPerKill]
    );

    await connection.query('DELETE FROM tournament_position_points WHERE tournament_id = ?', [tournamentId]);

    if (positionPoints.length > 0) {
      const values = positionPoints.map((p) => [tournamentId, p.position, p.points]);
      await connection.query(
        'INSERT INTO tournament_position_points (tournament_id, position, points) VALUES ?',
        [values]
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

export async function getTournamentContext(tournamentId) {
  const [rows] = await pool.query('SELECT id, organizer_id, status FROM tournaments WHERE id = ?', [tournamentId]);
  return rows[0] || null;
}
