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

describe('REAL MySQL & API Integration: Competition, Matches, Scoring & Qualifications', () => {
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

  it('creates rounds, groups, and assigns verified teams with locking in MySQL', async () => {
    const organizer = await createTestUser({ role: 'ORGANIZER' });
    const tournament = await createTestTournament(organizer.id, { status: 'LIVE' });

    const p1 = await createTestUser({ role: 'PLAYER' });
    const p2 = await createTestUser({ role: 'PLAYER' });
    const team1 = await createTestTeam(p1.id, { name: 'Alpha Squad' });
    const team2 = await createTestTeam(p2.id, { name: 'Bravo Squad' });

    const pool = getTestPool();
    // Register & verify teams
    await pool.query('INSERT INTO registrations (tournament_id, team_id, status) VALUES (?, ?, "VERIFIED"), (?, ?, "VERIFIED")', [
      tournament.id, team1.id,
      tournament.id, team2.id,
    ]);

    // 1. Create Round
    const roundRes = await request(app)
      .post(`/api/tournaments/${tournament.id}/rounds`)
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({ roundNumber: 1, name: 'Round 1 - Qualifiers' });

    expect(roundRes.status).toBe(201);
    const roundId = roundRes.body.round.id;

    // 2. Create Group
    const groupRes = await request(app)
      .post(`/api/rounds/${roundId}/groups`)
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({ name: 'Group A', groupSize: 12 });

    expect(groupRes.status).toBe(201);
    const groupId = groupRes.body.group.id;

    // 3. Assign Teams to Group
    const assign1 = await request(app)
      .post(`/api/groups/${groupId}/teams/${team1.id}`)
      .set('Authorization', `Bearer ${organizer.token}`);
    expect([200, 201]).toContain(assign1.status);

    const assign2 = await request(app)
      .post(`/api/groups/${groupId}/teams/${team2.id}`)
      .set('Authorization', `Bearer ${organizer.token}`);
    expect([200, 201]).toContain(assign2.status);

    // Verify group_teams rows in MySQL
    const [assignedRows] = await pool.query('SELECT * FROM group_teams WHERE group_id = ?', [groupId]);
    expect(assignedRows).toHaveLength(2);

    // 4. Lock Round Assignment
    const lockRes = await request(app)
      .post(`/api/rounds/${roundId}/lock`)
      .set('Authorization', `Bearer ${organizer.token}`);

    expect(lockRes.status).toBe(200);
    expect(lockRes.body.round.isLocked).toBe(true);

    const [roundDb] = await pool.query('SELECT is_locked, assignment_status FROM rounds WHERE id = ?', [roundId]);
    expect(roundDb[0].is_locked).toBe(1);
    expect(roundDb[0].assignment_status).toBe('LOCKED');
  });

  it('records match results, calculates placement/kill scoring, and aggregates leaderboard in MySQL', async () => {
    const organizer = await createTestUser({ role: 'ORGANIZER' });
    const tournament = await createTestTournament(organizer.id, { status: 'LIVE' });

    const p1 = await createTestUser({ role: 'PLAYER' });
    const p2 = await createTestUser({ role: 'PLAYER' });
    const team1 = await createTestTeam(p1.id, { name: 'Titan Gaming' });
    const team2 = await createTestTeam(p2.id, { name: 'Inferno Esports' });

    const pool = getTestPool();
    const [roundRes] = await pool.query(
      'INSERT INTO rounds (tournament_id, round_number, name, status, is_locked) VALUES (?, 1, "Quarter Finals", "IN_PROGRESS", 1)',
      [tournament.id]
    );
    const roundId = roundRes.insertId;

    const [groupRes] = await pool.query(
      'INSERT INTO `groups` (round_id, name, group_size, status) VALUES (?, "Group 1", 12, "IN_PROGRESS")',
      [roundId]
    );
    const groupId = groupRes.insertId;

    await pool.query('INSERT INTO group_teams (group_id, team_id) VALUES (?, ?), (?, ?)', [
      groupId, team1.id,
      groupId, team2.id,
    ]);

    // Create Match
    const matchRes = await request(app)
      .post(`/api/groups/${groupId}/matches`)
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({ matchNumber: 1, name: 'Match 1 - Bermuda' });

    expect(matchRes.status).toBe(201);
    const matchId = matchRes.body.match.id;

    // Record Result for Team 1 (Placement #1, 10 Kills)
    const result1 = await request(app)
      .post(`/api/matches/${matchId}/results`)
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({
        teamId: team1.id,
        placement: 1,
        kills: 10,
        points: 22,
      });

    expect(result1.status).toBe(201);

    // Record Result for Team 2 (Placement #2, 4 Kills)
    const result2 = await request(app)
      .post(`/api/matches/${matchId}/results`)
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({
        teamId: team2.id,
        placement: 2,
        kills: 4,
        points: 10,
      });

    expect(result2.status).toBe(201);

    // Verify stored in MySQL match_results
    const [results] = await pool.query('SELECT * FROM match_results WHERE match_id = ? ORDER BY placement ASC', [matchId]);
    expect(results).toHaveLength(2);
    expect(results[0].team_id).toBe(team1.id);
    expect(results[0].placement).toBe(1);
    expect(results[0].kills).toBe(10);

    // Verify leaderboard_entries
    const [leaderboard] = await pool.query('SELECT * FROM leaderboard_entries WHERE match_id = ? ORDER BY points DESC', [matchId]);
    expect(leaderboard).toHaveLength(2);
    expect(leaderboard[0].team_id).toBe(team1.id);
    expect(Number(leaderboard[0].points)).toBeGreaterThan(Number(leaderboard[1].points));

    // Get Group Leaderboard endpoint
    const lbRes = await request(app)
      .get(`/api/groups/${groupId}/leaderboard`)
      .set('Authorization', `Bearer ${organizer.token}`);

    expect(lbRes.status).toBe(200);
    expect(lbRes.body.leaderboard[0].teamId).toBe(team1.id);
    expect(lbRes.body.leaderboard[0].rank).toBe(1);
  });

  it('selects qualified teams and advances them to qualifications table in MySQL', async () => {
    const organizer = await createTestUser({ role: 'ORGANIZER' });
    const tournament = await createTestTournament(organizer.id, { status: 'LIVE' });

    const p1 = await createTestUser({ role: 'PLAYER' });
    const team1 = await createTestTeam(p1.id, { name: 'Qualifiers Team' });

    const pool = getTestPool();
    const [roundRes] = await pool.query(
      'INSERT INTO rounds (tournament_id, round_number, name, status, is_locked) VALUES (?, 1, "R1", "IN_PROGRESS", 1)',
      [tournament.id]
    );
    const roundId = roundRes.insertId;

    const [groupRes] = await pool.query(
      'INSERT INTO `groups` (round_id, name, group_size, status) VALUES (?, "G1", 12, "COMPLETED")',
      [roundId]
    );
    const groupId = groupRes.insertId;
    await pool.query('INSERT INTO group_teams (group_id, team_id) VALUES (?, ?)', [groupId, team1.id]);

    // Qualify team
    const qualRes = await request(app)
      .post(`/api/rounds/${roundId}/qualifications`)
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({
        teamId: team1.id,
        sourceGroupId: groupId,
      });

    expect(qualRes.status).toBe(201);

    const [qualRows] = await pool.query('SELECT * FROM qualifications WHERE round_id = ?', [roundId]);
    expect(qualRows).toHaveLength(1);
    expect(qualRows[0].team_id).toBe(team1.id);
    expect(qualRows[0].selected_by).toBe(organizer.id);
  });
});
