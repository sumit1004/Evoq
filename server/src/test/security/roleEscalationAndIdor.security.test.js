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

describe('Red-Team Security: Role Escalation & IDOR Attacks', () => {
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

  describe('Vertical Privilege Escalation Attacks', () => {
    it('blocks PLAYER role from creating tournaments (organizer-only endpoint)', async () => {
      const player = await createTestUser({ role: 'PLAYER' });

      const res = await request(app)
        .post('/api/tournaments')
        .set('Authorization', `Bearer ${player.token}`)
        .send({
          name: 'Hacked Tournament',
          registrationStartAt: new Date().toISOString(),
          registrationEndAt: new Date(Date.now() + 86400000).toISOString(),
          maxTeams: 16,
          playersPerTeam: 4,
          entryType: 'FREE',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks PLAYER role from connecting payment accounts', async () => {
      const player = await createTestUser({ role: 'PLAYER' });

      const res = await request(app)
        .post('/api/organizer/payment-account/connect')
        .set('Authorization', `Bearer ${player.token}`)
        .send({
          provider: 'MANUAL_UPI',
          providerAccountId: 'attacker@upi',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks SCOUT from executing owner-only tournament deletion', async () => {
      const organizer = await createTestUser({ role: 'ORGANIZER' });
      const scout = await createTestUser({ role: 'PLAYER' });
      const tournament = await createTestTournament(organizer.id, { status: 'DRAFT' });

      // Create organization and assign scout with full permissions except DELETE_TOURNAMENT
      const [orgRes] = await pool.query('INSERT INTO organizations (name, owner_id) VALUES ("Org", ?)', [organizer.id]);
      const orgId = orgRes.insertId;

      const [staffRes] = await pool.query(
        'INSERT INTO tournament_staff (organization_id, tournament_id, user_id, all_groups, status, created_by) VALUES (?, ?, ?, 1, "ACTIVE", ?)',
        [orgId, tournament.id, scout.id, organizer.id]
      );
      const staffId = staffRes.insertId;

      await pool.query(
        'INSERT INTO staff_permissions (tournament_staff_id, permission_key) VALUES (?, "EDIT_TOURNAMENT"), (?, "ENTER_RESULTS")',
        [staffId, staffId]
      );

      // Scout attempts to delete tournament
      const res = await request(app)
        .delete(`/api/tournaments/${tournament.id}`)
        .set('Authorization', `Bearer ${scout.token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');

      // Verify tournament still exists in MySQL
      const [rows] = await pool.query('SELECT * FROM tournaments WHERE id = ?', [tournament.id]);
      expect(rows).toHaveLength(1);
    });
  });

  describe('Horizontal Privilege Escalation (IDOR) Attacks', () => {
    it('blocks Player B from deleting Player A team', async () => {
      const victim = await createTestUser({ name: 'Victim Player', role: 'PLAYER' });
      const attacker = await createTestUser({ name: 'Attacker Player', role: 'PLAYER' });
      const team = await createTestTeam(victim.id, { name: 'Victim Elite Team' });

      // Attacker attempts to delete victim's team
      const res = await request(app)
        .delete(`/api/teams/${team.id}`)
        .set('Authorization', `Bearer ${attacker.token}`);

      expect(res.status).toBe(403);

      // Verify team remains intact in MySQL
      const [rows] = await pool.query('SELECT * FROM teams WHERE id = ?', [team.id]);
      expect(rows).toHaveLength(1);
    });

    it('blocks Attacker from reading Victim private direct messages (IDOR)', async () => {
      const userA = await createTestUser({ role: 'PLAYER' });
      const userB = await createTestUser({ role: 'PLAYER' });
      const attacker = await createTestUser({ role: 'PLAYER' });

      // Create conversation between userA and userB
      const [convRes] = await pool.query(
        'INSERT INTO direct_conversations (type) VALUES ("DIRECT")'
      );
      const conversationId = convRes.insertId;

      await pool.query(
        'INSERT INTO direct_conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)',
        [conversationId, userA.id, conversationId, userB.id]
      );

      await pool.query(
        'INSERT INTO direct_messages (conversation_id, sender_id, message) VALUES (?, ?, "Confidential Private Chat")',
        [conversationId, userA.id]
      );

      // Attacker attempts to list messages of victim conversation
      const res = await request(app)
        .get(`/api/messages/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${attacker.token}`);

      expect([403, 404]).toContain(res.status);
    });

    it('blocks Organizer B from viewing or reviewing Organizer A registrations (IDOR)', async () => {
      const organizerA = await createTestUser({ role: 'ORGANIZER' });
      const organizerB = await createTestUser({ role: 'ORGANIZER' });
      const tournamentA = await createTestTournament(organizerA.id, { status: 'REGISTRATION_OPEN' });

      const player = await createTestUser({ role: 'PLAYER' });
      const team = await createTestTeam(player.id);

      const [regRes] = await pool.query(
        'INSERT INTO registrations (tournament_id, team_id, status) VALUES (?, ?, "PENDING")',
        [tournamentA.id, team.id]
      );
      const regId = regRes.insertId;

      await pool.query(
        `INSERT INTO registration_member_snapshots (registration_id, user_id, player_name, email, unique_player_id)
         VALUES (?, ?, ?, ?, ?)`,
        [regId, player.id, player.name, player.email, player.uniquePlayerId]
      );

      // Organizer B attempts to review/verify Organizer A's registration
      const res = await request(app)
        .patch(`/api/registrations/${regId}`)
        .set('Authorization', `Bearer ${organizerB.token}`)
        .send({ status: 'VERIFIED' });

      expect([403, 404]).toContain(res.status);

      // Verify status in MySQL remains PENDING
      const [rows] = await pool.query('SELECT status FROM registrations WHERE id = ?', [regId]);
      expect(rows[0].status).toBe('PENDING');
    });

    it('blocks Organizer B from accessing Organizer A payment summary (IDOR)', async () => {
      const organizerA = await createTestUser({ role: 'ORGANIZER' });
      const organizerB = await createTestUser({ role: 'ORGANIZER' });
      const tournamentA = await createTestTournament(organizerA.id, {
        entry_type: 'PAID',
        entry_fee: 250,
      });

      const res = await request(app)
        .get(`/api/tournaments/${tournamentA.id}/payment-summary`)
        .set('Authorization', `Bearer ${organizerB.token}`);

      expect(res.status).toBe(403);
    });
  });
});
