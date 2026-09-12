import request from 'supertest';
import { describe, expect, it, beforeAll, beforeEach, afterAll } from 'vitest';
import { createApp } from '../../app.js';
import {
  setupTestDatabase,
  truncateAllTables,
  closeTestDatabase,
  createTestUser,
  createTestTeam,
  addTeamMember,
  createTestTournament,
  getTestPool,
} from '../testEnvironment.js';

describe('REAL MySQL & API Integration: Teams, Tournaments & Registrations', () => {
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

  it('creates a team, verifies ownership and roster constraints in MySQL', async () => {
    const captain = await createTestUser({ name: 'Captain Marvel', role: 'PLAYER' });
    const member1 = await createTestUser({ name: 'Player Two', role: 'PLAYER' });

    const createTeamRes = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${captain.token}`)
      .send({
        name: 'Apex Predators',
        memberPlayerIds: [member1.uniquePlayerId],
      });

    expect(createTeamRes.status).toBe(201);
    expect(createTeamRes.body.team.id).toBeDefined();
    expect(createTeamRes.body.team.name).toBe('Apex Predators');

    // Verify stored in MySQL
    const pool = getTestPool();
    const [teamRows] = await pool.query('SELECT * FROM teams WHERE id = ?', [createTeamRes.body.team.id]);
    expect(teamRows).toHaveLength(1);
    expect(teamRows[0].owner_id).toBe(captain.id);

    const [memberRows] = await pool.query('SELECT * FROM team_members WHERE team_id = ? ORDER BY role DESC', [createTeamRes.body.team.id]);
    expect(memberRows).toHaveLength(2);
    expect(memberRows.find((m) => m.user_id === captain.id).role).toBe('OWNER');
    expect(memberRows.find((m) => m.user_id === member1.id).role).toBe('MEMBER');
  });

  it('manages tournament lifecycle from DRAFT to REGISTRATION_OPEN to LIVE in MySQL', async () => {
    const organizer = await createTestUser({ name: 'Host Org', role: 'ORGANIZER' });

    // 1. Create Tournament (DRAFT)
    const createRes = await request(app)
      .post('/api/tournaments')
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({
        name: 'Summer Invitational 2026',
        registrationStartAt: new Date().toISOString(),
        registrationEndAt: new Date(Date.now() + 86400000).toISOString(),
        maxTeams: 8,
        playersPerTeam: 4,
        entryType: 'FREE',
      });

    expect(createRes.status).toBe(201);
    const tournamentId = createRes.body.tournament.id;
    expect(createRes.body.tournament.status).toBe('DRAFT');

    // 2. Open Registration
    const openRes = await request(app)
      .patch(`/api/tournaments/${tournamentId}`)
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({ status: 'REGISTRATION_OPEN' });

    expect(openRes.status).toBe(200);
    expect(openRes.body.tournament.status).toBe('REGISTRATION_OPEN');

    // 3. Close Registration
    const closeRes = await request(app)
      .patch(`/api/tournaments/${tournamentId}`)
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({ status: 'REGISTRATION_CLOSED' });

    expect(closeRes.status).toBe(200);
    expect(closeRes.body.tournament.status).toBe('REGISTRATION_CLOSED');

    // 4. Move to LIVE
    const liveRes = await request(app)
      .patch(`/api/tournaments/${tournamentId}`)
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({ status: 'LIVE' });

    expect(liveRes.status).toBe(200);
    expect(liveRes.body.tournament.status).toBe('LIVE');
  });

  it('submits tournament registration and verifies roster snapshots in MySQL', async () => {
    const organizer = await createTestUser({ role: 'ORGANIZER' });
    const pool = getTestPool();
    const now = new Date();
    const end = new Date(Date.now() + 86400000);
    const [tRes] = await pool.query(
      `INSERT INTO tournaments (organizer_id, name, registration_start_at, registration_end_at, max_teams, players_per_team, entry_type, entry_fee, status, game)
       VALUES (?, 'Open Cup', ?, ?, 4, 2, 'FREE', 0, 'REGISTRATION_OPEN', 'Free Fire')`,
      [organizer.id, now, end]
    );
    const tournament = { id: tRes.insertId };

    const captain = await createTestUser({ name: 'Leader One', role: 'PLAYER' });
    const member = await createTestUser({ name: 'Roster Player', role: 'PLAYER' });
    const team = await createTestTeam(captain.id, { name: 'Delta Force' });
    await addTeamMember(team.id, member.id);

    // Register team
    const regRes = await request(app)
      .post(`/api/tournaments/${tournament.id}/registrations`)
      .set('Authorization', `Bearer ${captain.token}`)
      .send({
        teamId: team.id,
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.registration.status).toBe('PENDING');

    const regId = regRes.body.registration.id;

    // Verify registration row
    const [regRows] = await pool.query('SELECT * FROM registrations WHERE id = ?', [regId]);
    expect(regRows).toHaveLength(1);
    expect(regRows[0].tournament_id).toBe(tournament.id);
    expect(regRows[0].team_id).toBe(team.id);

    // Verify roster member snapshot
    const [snapshots] = await pool.query('SELECT * FROM registration_member_snapshots WHERE registration_id = ?', [regId]);
    expect(snapshots.length).toBe(2);

    // Reject duplicate registration for the same team in the same tournament
    const dupRes = await request(app)
      .post(`/api/tournaments/${tournament.id}/registrations`)
      .set('Authorization', `Bearer ${captain.token}`)
      .send({ teamId: team.id });

    expect(dupRes.status).toBe(409);
  });

  it('allows tournament organizer to review, verify, and reject registrations in MySQL', async () => {
    const organizer = await createTestUser({ role: 'ORGANIZER' });
    const tournament = await createTestTournament(organizer.id, { status: 'REGISTRATION_OPEN' });

    const captain1 = await createTestUser({ role: 'PLAYER' });
    const team1 = await createTestTeam(captain1.id);
    const captain2 = await createTestUser({ role: 'PLAYER' });
    const team2 = await createTestTeam(captain2.id);

    // Create registrations directly
    const pool = getTestPool();
    const [regRes1] = await pool.query(
      'INSERT INTO registrations (tournament_id, team_id, status) VALUES (?, ?, ?)',
      [tournament.id, team1.id, 'PENDING']
    );
    const regId1 = regRes1.insertId;
    await pool.query(
      `INSERT INTO registration_member_snapshots (registration_id, user_id, player_name, email, unique_player_id)
       VALUES (?, ?, ?, ?, ?)`,
      [regId1, captain1.id, captain1.name, captain1.email, captain1.uniquePlayerId]
    );

    const [regRes2] = await pool.query(
      'INSERT INTO registrations (tournament_id, team_id, status) VALUES (?, ?, ?)',
      [tournament.id, team2.id, 'PENDING']
    );
    const regId2 = regRes2.insertId;
    await pool.query(
      `INSERT INTO registration_member_snapshots (registration_id, user_id, player_name, email, unique_player_id)
       VALUES (?, ?, ?, ?, ?)`,
      [regId2, captain2.id, captain2.name, captain2.email, captain2.uniquePlayerId]
    );

    // 1. Verify Registration 1
    const verifyRes = await request(app)
      .patch(`/api/registrations/${regId1}`)
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({ status: 'VERIFIED' });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.registration.status).toBe('VERIFIED');

    const [verifiedRows] = await pool.query('SELECT status, verified_by FROM registrations WHERE id = ?', [regId1]);
    expect(verifiedRows[0].status).toBe('VERIFIED');
    expect(verifiedRows[0].verified_by).toBe(organizer.id);

    // 2. Reject Registration 2 with reason
    const rejectRes = await request(app)
      .patch(`/api/registrations/${regId2}`)
      .set('Authorization', `Bearer ${organizer.token}`)
      .send({ status: 'REJECTED', rejectionReason: 'Ineligible player age' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.registration.status).toBe('REJECTED');
    expect(rejectRes.body.registration.rejectionReason).toBe('Ineligible player age');
  });
});
