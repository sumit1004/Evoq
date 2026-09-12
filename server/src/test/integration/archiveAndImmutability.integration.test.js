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

describe('REAL MySQL & API Integration: Archive & Completed Tournament Immutability', () => {
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

  async function createCompletedTournamentContext() {
    const organizer = await createTestUser({ role: 'ORGANIZER' });
    const tournament = await createTestTournament(organizer.id, { status: 'LIVE' });

    const p1 = await createTestUser({ role: 'PLAYER' });
    const team1 = await createTestTeam(p1.id, { name: 'Champion Warriors' });

    const pool = getTestPool();
    // 1. Register & verify
    const [regRes] = await pool.query(
      'INSERT INTO registrations (tournament_id, team_id, status) VALUES (?, ?, "PENDING")',
      [tournament.id, team1.id]
    );
    const regId = regRes.insertId;

    await pool.query(
      `INSERT INTO registration_member_snapshots (registration_id, user_id, player_name, email, unique_player_id)
       VALUES (?, ?, ?, ?, ?)`,
      [regId, p1.id, p1.name, p1.email, p1.uniquePlayerId]
    );

    // 2. Create Announcement
    await pool.query(
      'INSERT INTO announcements (tournament_id, created_by, message) VALUES (?, ?, "Official Grand Finals")',
      [tournament.id, organizer.id]
    );

    // 3. Final Round, Group, Match, Results
    const [rRes] = await pool.query(
      'INSERT INTO rounds (tournament_id, round_number, name, status, is_locked) VALUES (?, 1, "Finals", "COMPLETED", 1)',
      [tournament.id]
    );
    const roundId = rRes.insertId;

    const [gRes] = await pool.query(
      'INSERT INTO `groups` (round_id, name, group_size, status, room_id, room_password) VALUES (?, "Final Group", 12, "COMPLETED", "ROOM_123", "PASS_123")',
      [roundId]
    );
    const groupId = gRes.insertId;

    await pool.query('INSERT INTO group_teams (group_id, team_id) VALUES (?, ?)', [groupId, team1.id]);

    const [mRes] = await pool.query(
      'INSERT INTO matches (group_id, match_number, name, status) VALUES (?, 1, "Final Match", "COMPLETED")',
      [groupId]
    );
    const matchId = mRes.insertId;

    await pool.query(
      'INSERT INTO match_results (match_id, team_id, points, kills, placement, uploaded_by) VALUES (?, ?, 25, 10, 1, ?)',
      [matchId, team1.id, organizer.id]
    );

    await pool.query(
      'INSERT INTO leaderboard_entries (match_id, team_id, points, kills, `rank`) VALUES (?, ?, 25, 10, 1)',
      [matchId, team1.id]
    );

    // Chat message to verify cleanup
    await pool.query(
      'INSERT INTO chat_messages (group_id, sender_id, message) VALUES (?, ?, "Good game")',
      [groupId, p1.id]
    );

    return { organizer, tournament, team1, regId, roundId, groupId, matchId };
  }

  it('completes tournament, creates permanent snapshot, preserves announcements, and cleans transient data in MySQL', async () => {
    const { organizer, tournament, team1, groupId } = await createCompletedTournamentContext();
    const pool = getTestPool();

    // Execute complete tournament via API / service
    const completeRes = await request(app)
      .post(`/api/tournaments/${tournament.id}/complete`)
      .set('Authorization', `Bearer ${organizer.token}`);

    expect(completeRes.status).toBe(201);
    expect(completeRes.body.archive).toBeDefined();

    // Verify tournament status updated to COMPLETED in MySQL
    const [tDb] = await pool.query('SELECT status, completed_at FROM tournaments WHERE id = ?', [tournament.id]);
    expect(tDb[0].status).toBe('COMPLETED');
    expect(tDb[0].completed_at).not.toBeNull();

    // Verify immutable archive snapshot created in tournament_archives
    const [archiveDb] = await pool.query('SELECT * FROM tournament_archives WHERE tournament_id = ?', [tournament.id]);
    expect(archiveDb).toHaveLength(1);
    expect(archiveDb[0].tournament_name).toBeDefined();

    // Verify announcements preserved in MySQL
    const [announcements] = await pool.query('SELECT * FROM announcements WHERE tournament_id = ?', [tournament.id]);
    expect(announcements.length).toBeGreaterThanOrEqual(1);

    // Verify transient data cleaned (room passwords wiped from groups)
    const [groupDb] = await pool.query('SELECT room_id, room_password FROM `groups` WHERE id = ?', [groupId]);
    expect(groupDb[0].room_password).toBeNull();

    // Verify Idempotent re-execution returns existing archive
    const repeatRes = await request(app)
      .post(`/api/tournaments/${tournament.id}/complete`)
      .set('Authorization', `Bearer ${organizer.token}`);

    expect([200, 201]).toContain(repeatRes.status);
    expect(repeatRes.body.archive.id).toBe(completeRes.body.archive.id);
  });

  it('rejects all mutation operations on COMPLETED tournament (Strict Immutability Suite)', async () => {
    const { organizer, tournament, regId, roundId, groupId, matchId } = await createCompletedTournamentContext();

    // Complete tournament first
    await request(app)
      .post(`/api/tournaments/${tournament.id}/complete`)
      .set('Authorization', `Bearer ${organizer.token}`);

    const extraPlayer = await createTestUser({ role: 'PLAYER' });
    const extraTeam = await createTestTeam(extraPlayer.id);

    // 1. Attempt new registration on completed tournament -> 409
    const regAttempt = await request(app)
      .post(`/api/tournaments/${tournament.id}/registrations`)
      .set('Authorization', `Bearer ${extraPlayer.token}`)
      .send({ teamId: extraTeam.id });
    expect([409, 400]).toContain(regAttempt.status);

    // 2. Attempt registration review on completed tournament -> 409
    const reviewAttempt = await request(app)
      .patch(`/api/registrations/${regId}`)
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({ status: 'REJECTED', rejectionReason: 'Not allowed on completed' });
    expect(reviewAttempt.status).toBe(409);

    // 3. Attempt round creation on completed tournament -> 409
    const roundAttempt = await request(app)
      .post(`/api/tournaments/${tournament.id}/rounds`)
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({ roundNumber: 2, name: 'Round 2' });
    expect(roundAttempt.status).toBe(409);

    // 4. Attempt group creation on completed tournament -> 409
    const groupAttempt = await request(app)
      .post(`/api/rounds/${roundId}/groups`)
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({ name: 'Group B', groupSize: 12 });
    expect(groupAttempt.status).toBe(409);

    // 5. Attempt team assignment on completed tournament -> 409
    const assignAttempt = await request(app)
      .post(`/api/groups/${groupId}/teams/${extraTeam.id}`)
      .set('Authorization', `Bearer ${organizer.token}`);
    expect(assignAttempt.status).toBe(409);

    // 6. Attempt match creation on completed tournament -> 409
    const matchAttempt = await request(app)
      .post(`/api/groups/${groupId}/matches`)
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({ matchNumber: 2, name: 'Match 2' });
    expect(matchAttempt.status).toBe(409);

    // 7. Attempt score update on completed tournament -> 409
    const scoreAttempt = await request(app)
      .post(`/api/matches/${matchId}/results`)
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({ teamId: extraTeam.id, placement: 1, kills: 5, points: 15 });
    expect(scoreAttempt.status).toBe(409);

    // 8. Attempt qualifications modification on completed tournament -> 409
    const qualAttempt = await request(app)
      .post(`/api/rounds/${roundId}/qualifications`)
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({ teamId: extraTeam.id, sourceGroupId: groupId });
    expect(qualAttempt.status).toBe(409);
  });
});
