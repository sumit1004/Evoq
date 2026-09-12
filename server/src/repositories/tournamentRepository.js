import { pool } from '../config/database.js';

const fields = `id, organizer_id, name, description, tournament_date, registration_start_at,
  registration_end_at, max_teams, players_per_team, entry_type, entry_fee,
  payment_qr_path, payment_instructions, status, completed_at, created_at, updated_at,
  payment_method, upi_id, payment_account_id, game`;

export async function listTournaments({ organizerId, viewerId, search, status, entryType, sort, page = 1, limit = 12 } = {}) {
  const selectFields = `t.id, t.organizer_id, t.name, t.description, t.tournament_date, t.registration_start_at,
    t.registration_end_at, t.max_teams, t.players_per_team, t.entry_type, t.entry_fee,
    t.payment_qr_path, t.payment_instructions, t.status, t.completed_at, t.created_at, t.updated_at,
    t.payment_method, t.upi_id, t.payment_account_id, t.game,
    COUNT(DISTINCT r.id) AS registered_teams,
    (SELECT r2.status
     FROM registrations r2
     JOIN team_members tm ON tm.team_id = r2.team_id
     WHERE r2.tournament_id = t.id AND tm.user_id = ?
     LIMIT 1) AS player_registration_status`;

  let whereClauses = [];
  let params = [];

  // viewerId is the first parameter in the select fields subquery for player registration status
  params.push(viewerId || null);

  if (organizerId) {
    whereClauses.push('(t.organizer_id = ? OR t.id IN (SELECT tournament_id FROM tournament_staff WHERE user_id = ? AND status = \'ACTIVE\'))');
    params.push(organizerId, organizerId);
  } else {
    // Public available: exclude DRAFT unless it belongs to the viewerId
    if (viewerId) {
      whereClauses.push('(t.status <> ? OR t.organizer_id = ?)');
      params.push('DRAFT', viewerId);
    } else {
      whereClauses.push('t.status <> ?');
      params.push('DRAFT');
    }
  }

  if (search) {
    whereClauses.push('(t.name LIKE ? OR t.description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (status) {
    whereClauses.push('t.status = ?');
    params.push(status);
  }

  if (entryType) {
    whereClauses.push('t.entry_type = ?');
    params.push(entryType);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Count total matches for pagination
  const countQuery = `SELECT COUNT(DISTINCT t.id) AS total FROM tournaments t ${whereSql}`;
  const countParams = params.slice(1);
  const [countResult] = await pool.query(countQuery, countParams);
  const total = countResult[0]?.total || 0;

  // Sorting
  let orderBy = 't.created_at DESC';
  if (sort === 'closing_soon') {
    orderBy = 't.registration_end_at ASC';
  } else if (sort === 'date_soonest') {
    orderBy = 't.tournament_date ASC';
  } else if (sort === 'default') {
    orderBy = `CASE t.status
      WHEN 'REGISTRATION_OPEN' THEN 1
      WHEN 'LIVE' THEN 2
      WHEN 'REGISTRATION_CLOSED' THEN 3
      WHEN 'COMPLETED' THEN 4
      ELSE 5
    END, t.tournament_date ASC`;
  }

  // Pagination offset
  const safePage = Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  const safeLimit = Number.isInteger(Number(limit)) && Number(limit) > 0 && Number(limit) <= 100 ? Number(limit) : 12;
  const offset = (safePage - 1) * safeLimit;
  const listQuery = `
    SELECT ${selectFields}
    FROM tournaments t
    LEFT JOIN registrations r ON r.tournament_id = t.id AND r.status IN ('PENDING', 'VERIFIED')
    ${whereSql}
    GROUP BY t.id
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query(listQuery, [...params, safeLimit, offset]);
  return { rows, total };
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
      `INSERT INTO tournaments (organizer_id, organization_id, name, description, tournament_date, registration_start_at, registration_end_at, max_teams, players_per_team, entry_type, entry_fee, payment_qr_path, payment_instructions, payment_method, upi_id, payment_account_id, game)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.organizerId,
        input.organizationId || null,
        input.name,
        input.description || null,
        input.tournamentDate ? new Date(input.tournamentDate) : null,
        new Date(input.registrationStartAt),
        new Date(input.registrationEndAt),
        input.maxTeams,
        input.playersPerTeam,
        input.entryType,
        input.entryFee,
        input.paymentQrPath || null,
        input.paymentInstructions || null,
        input.paymentMethod || null,
        input.upiId || null,
        input.paymentAccountId || null,
        input.game || 'Free Fire',
      ],
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
    const allowed = {
      name: 'name',
      description: 'description',
      tournamentDate: 'tournament_date',
      registrationStartAt: 'registration_start_at',
      registrationEndAt: 'registration_end_at',
      maxTeams: 'max_teams',
      playersPerTeam: 'players_per_team',
      entryType: 'entry_type',
      entryFee: 'entry_fee',
      paymentInstructions: 'payment_instructions',
      status: 'status',
      paymentMethod: 'payment_method',
      upiId: 'upi_id',
      paymentAccountId: 'payment_account_id',
      paymentQrPath: 'payment_qr_path',
      game: 'game',
    };
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

export async function findTournamentForUpdate(tournamentId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT ${fields} FROM tournaments WHERE id = ? FOR UPDATE`,
    [tournamentId],
  );
  return rows[0] || null;
}

export async function deleteTournament(tournamentId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // Delete payments
    await connection.query('DELETE FROM payments WHERE tournament_id = ?', [tournamentId]);
    // Delete tournament record (cascades to rounds, groups, group_teams, matches, registrations, prizes, announcements, archives)
    await connection.query('DELETE FROM tournaments WHERE id = ?', [tournamentId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
