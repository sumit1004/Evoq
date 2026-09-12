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

describe('REAL MySQL & API Integration: Cross-Tenant & Cross-Tournament Isolation', () => {
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

  it('strictly isolates tournaments and prevents cross-organizer access & mutations in MySQL', async () => {
    const orgA = await createTestUser({ name: 'Organizer A', role: 'ORGANIZER' });
    const orgB = await createTestUser({ name: 'Organizer B', role: 'ORGANIZER' });

    const tourneyA = await createTestTournament(orgA.id, { name: 'Tournament Alpha', status: 'LIVE' });
    const tourneyB = await createTestTournament(orgB.id, { name: 'Tournament Bravo', status: 'LIVE' });

    const playerB = await createTestUser({ name: 'Player B', role: 'PLAYER' });
    const teamB = await createTestTeam(playerB.id, { name: 'Team Bravo' });

    const pool = getTestPool();
    // 1. Register Team B in Tournament B
    const [regBRes] = await pool.query(
      'INSERT INTO registrations (tournament_id, team_id, status, payment_screenshot_path) VALUES (?, ?, "PENDING", "proof-b.png")',
      [tourneyB.id, teamB.id]
    );
    const regBId = regBRes.insertId;

    // 2. Create Round & Group in Tournament B
    const [roundBRes] = await pool.query(
      'INSERT INTO rounds (tournament_id, round_number, name, status) VALUES (?, 1, "R1-B", "IN_PROGRESS")',
      [tourneyB.id]
    );
    const roundBId = roundBRes.insertId;

    const [groupBRes] = await pool.query(
      'INSERT INTO `groups` (round_id, name, group_size, status) VALUES (?, "Group B1", 12, "IN_PROGRESS")',
      [roundBId]
    );
    const groupBId = groupBRes.insertId;

    // --- TEST ISOLATION BOUNDARIES ---

    // A. Organizer A attempts to review Tournament B registration -> 403 or 404
    const crossRegReview = await request(app)
      .patch(`/api/registrations/${regBId}`)
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ status: 'VERIFIED' });

    expect([403, 404]).toContain(crossRegReview.status);

    // B. Organizer A attempts to create round in Tournament B -> 403 or 404
    const crossRoundCreate = await request(app)
      .post(`/api/tournaments/${tourneyB.id}/rounds`)
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ roundNumber: 2, name: 'Hacked Round' });

    expect([403, 404]).toContain(crossRoundCreate.status);

    // C. Organizer A attempts to create group in Tournament B's round -> 403 or 404
    const crossGroupCreate = await request(app)
      .post(`/api/rounds/${roundBId}/groups`)
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ name: 'Hacked Group', groupSize: 12 });

    expect([403, 404]).toContain(crossGroupCreate.status);

    // D. Organizer A attempts to access Tournament B payment evidence -> 403 or 404
    const crossEvidenceAccess = await request(app)
      .get(`/api/registrations/${regBId}/payment-evidence`)
      .set('Authorization', `Bearer ${orgA.token}`);

    expect([403, 404]).toContain(crossEvidenceAccess.status);

    // E. Organizer A attempts to delete Tournament B -> 403 or 404
    const crossTourneyDelete = await request(app)
      .delete(`/api/tournaments/${tourneyB.id}`)
      .set('Authorization', `Bearer ${orgA.token}`);

    expect([403, 404]).toContain(crossTourneyDelete.status);
  });

  it('prevents players from modifying other players teams and private data in MySQL', async () => {
    const player1 = await createTestUser({ name: 'Legit Owner', role: 'PLAYER' });
    const player2 = await createTestUser({ name: 'Rogue Player', role: 'PLAYER' });

    const team1 = await createTestTeam(player1.id, { name: 'Elite Guard' });

    // Player 2 attempts to add member to Team 1 -> 403 or 404
    const crossTeamMod = await request(app)
      .post(`/api/teams/${team1.id}/members`)
      .set('Authorization', `Bearer ${player2.token}`)
      .send({ userId: player2.id });

    expect([403, 404]).toContain(crossTeamMod.status);

    // Player 2 attempts to delete Team 1 -> 403 or 404
    const crossTeamDel = await request(app)
      .delete(`/api/teams/${team1.id}`)
      .set('Authorization', `Bearer ${player2.token}`);

    expect([403, 404]).toContain(crossTeamDel.status);
  });
});
