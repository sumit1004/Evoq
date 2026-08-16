import { pool } from '../config/database.js';

const fields = `id, organizer_id, name, description, tournament_date, registration_start_at,
  registration_end_at, max_teams, players_per_team, entry_type, entry_fee,
  payment_qr_path, payment_instructions, status, completed_at, created_at, updated_at`;

export async function listTournaments({ organizerId } = {}) {
  const [rows] = organizerId
    ? await pool.query(`SELECT ${fields} FROM tournaments WHERE organizer_id = ? ORDER BY created_at DESC`, [organizerId])
    : await pool.query(`SELECT ${fields} FROM tournaments WHERE status <> 'DRAFT' ORDER BY tournament_date IS NULL, tournament_date ASC`);
  return rows;
}

export async function findTournament(tournamentId) {
  const [rows] = await pool.query(`SELECT ${fields} FROM tournaments WHERE id = ? LIMIT 1`, [tournamentId]);
  return rows[0] || null;
}

export async function createTournament(input) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO tournaments (organizer_id, name, description, tournament_date, registration_start_at, registration_end_at, max_teams, players_per_team, entry_type, entry_fee, payment_qr_path, payment_instructions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.organizerId, input.name, input.description || null, input.tournamentDate || null, input.registrationStartAt, input.registrationEndAt, input.maxTeams, input.playersPerTeam, input.entryType, input.entryFee, input.paymentQrPath || null, input.paymentInstructions || null],
    );
    if (input.prizes?.length) {
      await connection.query('INSERT INTO tournament_prizes (tournament_id, position, amount) VALUES ?', [input.prizes.map((prize) => [result.insertId, prize.position, prize.amount])]);
    }
    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

export async function updateTournament(tournamentId, input) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const columns = [];
    const values = [];
    const allowed = { name: 'name', description: 'description', tournamentDate: 'tournament_date', registrationStartAt: 'registration_start_at', registrationEndAt: 'registration_end_at', maxTeams: 'max_teams', playersPerTeam: 'players_per_team', entryType: 'entry_type', entryFee: 'entry_fee', paymentInstructions: 'payment_instructions', status: 'status' };
    for (const [key, column] of Object.entries(allowed)) {
      if (input[key] !== undefined) { columns.push(`${column} = ?`); values.push(input[key]); }
    }
    if (columns.length) { values.push(tournamentId); await connection.query(`UPDATE tournaments SET ${columns.join(', ')} WHERE id = ?`, values); }
    if (input.prizes !== undefined) {
      await connection.query('DELETE FROM tournament_prizes WHERE tournament_id = ?', [tournamentId]);
      if (input.prizes.length) await connection.query('INSERT INTO tournament_prizes (tournament_id, position, amount) VALUES ?', [input.prizes.map((prize) => [tournamentId, prize.position, prize.amount])]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

export async function listPrizes(tournamentId) {
  const [rows] = await pool.query('SELECT position, amount FROM tournament_prizes WHERE tournament_id = ? ORDER BY position ASC', [tournamentId]);
  return rows;
}
