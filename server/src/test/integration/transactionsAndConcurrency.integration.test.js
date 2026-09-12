import request from 'supertest';
import { describe, expect, it, beforeAll, beforeEach, afterAll } from 'vitest';
import { createApp } from '../../app.js';
import {
  setupTestDatabase,
  truncateAllTables,
  closeTestDatabase,
  createTestUser,
  createTestTeam,
  createTestTournament,
  getTestPool,
} from '../testEnvironment.js';

describe('REAL MySQL & API Integration: Transactions & Concurrency', () => {
  let app;

  beforeAll(async () => {
    await setupTestDatabase();
    app = createApp();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('rolls back completely when a failure occurs during a transactional operation (Zero Partial State)', async () => {
    const organizer = await createTestUser({ role: 'ORGANIZER' });
    const tournament = await createTestTournament(organizer.id, { status: 'LIVE' });
    const pool = getTestPool();

    // Begin custom transaction that intentionally fails on step 2
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Step 1: Insert user
      const [uRes] = await conn.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES ("Rollback User", "rb@evoq.gg", "hash", "PLAYER")'
      );
      const tempUserId = uRes.insertId;

      // Step 2: Intentionally trigger foreign key error by referencing nonexistent team
      let errorOccurred = false;
      try {
        await conn.query(
          'INSERT INTO team_members (team_id, user_id, role) VALUES (999999, ?, "MEMBER")',
          [tempUserId]
        );
      } catch (err) {
        errorOccurred = true;
        await conn.rollback();
      }

      expect(errorOccurred).toBe(true);

      // Verify Step 1 was completely rolled back from MySQL
      const [rows] = await pool.query('SELECT * FROM users WHERE email = "rb@evoq.gg"');
      expect(rows).toHaveLength(0);
    } finally {
      conn.release();
    }
  });

  it('handles simultaneous concurrent registrations for the same team without creating duplicate records', async () => {
    const organizer = await createTestUser({ role: 'ORGANIZER' });
    const pool = getTestPool();
    const [tRes] = await pool.query(
      `INSERT INTO tournaments (organizer_id, name, registration_start_at, registration_end_at, max_teams, players_per_team, entry_type, entry_fee, status, game)
       VALUES (?, 'Speed Cup', ?, ?, 8, 1, 'FREE', 0, 'REGISTRATION_OPEN', 'Free Fire')`,
      [organizer.id, new Date(), new Date(Date.now() + 86400000)]
    );
    const tournament = { id: tRes.insertId };

    const captain = await createTestUser({ role: 'PLAYER' });
    const team = await createTestTeam(captain.id, { name: 'Speed Squad' });

    // Fire 5 concurrent registration requests for the same team simultaneously
    const requests = Array.from({ length: 5 }, () =>
      request(app)
        .post(`/api/tournaments/${tournament.id}/registrations`)
        .set('Authorization', `Bearer ${captain.token}`)
        .send({ teamId: team.id })
    );

    const responses = await Promise.all(requests);
    const successCount = responses.filter((r) => r.status === 201).length;
    const conflictCount = responses.filter((r) => r.status === 409).length;

    // Exactly 1 must succeed with 201, and the rest must receive 409 Conflict
    expect(successCount).toBe(1);
    expect(conflictCount).toBe(4);

    // Verify exactly 1 registration row in MySQL
    const [regRows] = await pool.query(
      'SELECT * FROM registrations WHERE tournament_id = ? AND team_id = ?',
      [tournament.id, team.id]
    );
    expect(regRows).toHaveLength(1);
  });

  it('handles concurrent tournament completion requests idempotently with single archive record', async () => {
    const organizer = await createTestUser({ role: 'ORGANIZER' });
    const tournament = await createTestTournament(organizer.id, { status: 'LIVE' });

    const p1 = await createTestUser({ role: 'PLAYER' });
    const team1 = await createTestTeam(p1.id, { name: 'Concurrent Champs' });

    const pool = getTestPool();
    // Complete setup in MySQL
    await pool.query('INSERT INTO registrations (tournament_id, team_id, status) VALUES (?, ?, "VERIFIED")', [tournament.id, team1.id]);
    const [rRes] = await pool.query('INSERT INTO rounds (tournament_id, round_number, name, status, is_locked) VALUES (?, 1, "R1", "COMPLETED", 1)', [tournament.id]);
    const roundId = rRes.insertId;
    const [gRes] = await pool.query('INSERT INTO `groups` (round_id, name, group_size, status) VALUES (?, "G1", 12, "COMPLETED")', [roundId]);
    const groupId = gRes.insertId;
    await pool.query('INSERT INTO group_teams (group_id, team_id) VALUES (?, ?)', [groupId, team1.id]);
    const [mRes] = await pool.query('INSERT INTO matches (group_id, match_number, name, status) VALUES (?, 1, "M1", "COMPLETED")', [groupId]);
    const matchId = mRes.insertId;
    await pool.query('INSERT INTO match_results (match_id, team_id, points, kills, placement, uploaded_by) VALUES (?, ?, 30, 10, 1, ?)', [matchId, team1.id, organizer.id]);
    await pool.query('INSERT INTO leaderboard_entries (match_id, team_id, points, kills, `rank`) VALUES (?, ?, 30, 10, 1)', [matchId, team1.id]);

    // Send 3 simultaneous completion requests
    const completeRequests = Array.from({ length: 3 }, () =>
      request(app)
        .post(`/api/tournaments/${tournament.id}/complete`)
        .set('Authorization', `Bearer ${organizer.token}`)
    );

    const responses = await Promise.all(completeRequests);
    const successfulResponses = responses.filter((r) => r.status === 201 || r.status === 200);

    // All return 200/201 with the valid archive snapshot
    expect(successfulResponses.length).toBe(3);

    // Verify exactly 1 archive record in MySQL
    const [archiveRows] = await pool.query('SELECT * FROM tournament_archives WHERE tournament_id = ?', [tournament.id]);
    expect(archiveRows).toHaveLength(1);
  });
});
