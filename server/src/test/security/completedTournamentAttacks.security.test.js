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

describe('Red-Team Security: Completed Tournament Immutability Attack Matrix', () => {
  let app;
  let pool;

  beforeAll(async () => {
    pool = await setupTestDatabase();
    app = createApp();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  async function createFullCompletedTournament() {
    const organizer = await createTestUser({ role: 'ORGANIZER' });
    const tournament = await createTestTournament(organizer.id, { status: 'LIVE' });

    const player = await createTestUser({ role: 'PLAYER' });
    const team = await createTestTeam(player.id);

    const [regRes] = await pool.query(
      'INSERT INTO registrations (tournament_id, team_id, status) VALUES (?, ?, "PENDING")',
      [tournament.id, team.id]
    );
    const regId = regRes.insertId;

    await pool.query(
      `INSERT INTO registration_member_snapshots (registration_id, user_id, player_name, email, unique_player_id)
       VALUES (?, ?, ?, ?, ?)`,
      [regId, player.id, player.name, player.email, player.uniquePlayerId]
    );

    const [rRes] = await pool.query(
      'INSERT INTO rounds (tournament_id, round_number, name, status, is_locked) VALUES (?, 1, "R1", "COMPLETED", 1)',
      [tournament.id]
    );
    const roundId = rRes.insertId;

    const [gRes] = await pool.query(
      'INSERT INTO `groups` (round_id, name, group_size, status) VALUES (?, "G1", 12, "COMPLETED")',
      [roundId]
    );
    const groupId = gRes.insertId;

    await pool.query('INSERT INTO group_teams (group_id, team_id) VALUES (?, ?)', [groupId, team.id]);

    const [mRes] = await pool.query(
      'INSERT INTO matches (group_id, match_number, name, status) VALUES (?, 1, "M1", "COMPLETED")',
      [groupId]
    );
    const matchId = mRes.insertId;

    await pool.query(
      'INSERT INTO match_results (match_id, team_id, points, kills, placement, uploaded_by) VALUES (?, ?, 20, 8, 1, ?)',
      [matchId, team.id, organizer.id]
    );

    await pool.query(
      'INSERT INTO leaderboard_entries (match_id, team_id, points, kills) VALUES (?, ?, 20, 8)',
      [matchId, team.id]
    );

    // Complete tournament
    const completeRes = await request(app)
      .post(`/api/tournaments/${tournament.id}/complete`)
      .set('Authorization', `Bearer ${organizer.token}`);
    expect([200, 201]).toContain(completeRes.status);

    return { organizer, tournament, player, team, regId, roundId, groupId, matchId };
  }

  it('rejects tournament status downgrade from COMPLETED to LIVE or DRAFT', async () => {
    const { organizer, tournament } = await createFullCompletedTournament();

    const patchRes = await request(app)
      .patch(`/api/tournaments/${tournament.id}`)
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({ status: 'LIVE' });

    expect(patchRes.status).toBe(409);
    expect(patchRes.body.error.code).toBe('CONFLICT');
  });

  it('rejects scoring configuration updates on COMPLETED tournaments', async () => {
    const { organizer, tournament } = await createFullCompletedTournament();

    const putRes = await request(app)
      .put(`/api/tournaments/${tournament.id}/scoring-config`)
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({
        killPointMultiplier: 2.0,
        positionPoints: [{ position: 1, points: 25 }],
      });

    expect(putRes.status).toBe(409);
    expect(putRes.body.error.code).toBe('CONFLICT');
  });

  it('rejects round completion and modifications on COMPLETED tournaments', async () => {
    const { organizer, roundId } = await createFullCompletedTournament();

    const completeRoundRes = await request(app)
      .post(`/api/rounds/${roundId}/complete`)
      .set('Authorization', `Bearer ${organizer.token}`);

    expect(completeRoundRes.status).toBe(409);
  });

  it('rejects match result modifications and additions on COMPLETED tournaments', async () => {
    const { organizer, matchId, team } = await createFullCompletedTournament();

    const resultRes = await request(app)
      .post(`/api/matches/${matchId}/results`)
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({
        teamId: team.id,
        placement: 1,
        kills: 15,
        points: 30,
      });

    expect(resultRes.status).toBe(409);
  });

  it('rejects qualifications modifications on COMPLETED tournaments', async () => {
    const { organizer, roundId, team, groupId } = await createFullCompletedTournament();

    const qualRes = await request(app)
      .post(`/api/rounds/${roundId}/qualifications`)
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({
        teamId: team.id,
        sourceGroupId: groupId,
      });

    expect(qualRes.status).toBe(409);
  });
});
