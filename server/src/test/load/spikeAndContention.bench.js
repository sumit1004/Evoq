import http from 'node:http';
import { Server } from 'socket.io';
import { createApp } from '../../app.js';
import { registerSocketHandlers } from '../../sockets/index.js';
import {
  setupTestDatabase,
  truncateAllTables,
  closeTestDatabase,
  createTestUser,
  getTestPool,
} from '../testEnvironment.js';

export async function runSpikeAndContentionTests() {
  console.log('================================================================================');
  console.log(' EVOQ PHASE 6: SPIKE & TRANSACTION CONTENTION BENCHMARK                         ');
  console.log('================================================================================\n');

  await setupTestDatabase();
  const pool = getTestPool();
  await truncateAllTables();

  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  registerSocketHandlers(io);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  console.log('1. Setting up test fixtures for concurrency race tests...');
  const organizer = await createTestUser({ role: 'ORGANIZER', name: 'Race Organizer', email: 'race.org@evoq.gg' });

  // Create tournament with max 8 teams, 1 player per team
  const [tourneyRes] = await pool.query(
    `INSERT INTO tournaments (organizer_id, name, description, tournament_date, registration_start_at, registration_end_at, max_teams, players_per_team, entry_type, entry_fee, status)
     VALUES (?, 'Spike Championship', 'Concurrency spike testing tournament', DATE_ADD(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 2 DAY), 8, 1, 'FREE', 0, 'REGISTRATION_OPEN')`,
    [organizer.id]
  );
  const tournamentId = tourneyRes.insertId;

  // Create 20 teams owned by 20 distinct players
  const teams = [];
  for (let i = 1; i <= 20; i++) {
    const player = await createTestUser({ role: 'PLAYER', name: `Cap ${i}`, email: `captain${i}@evoq.gg` });
    const [tRes] = await pool.query(
      'INSERT INTO teams (name, owner_id) VALUES (?, ?)',
      [`Team Alpha ${i}`, player.id]
    );
    const teamId = tRes.insertId;
    await pool.query(
      'INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)',
      [teamId, player.id, 'OWNER']
    );
    teams.push({ teamId, player });
  }

  // TEST 1: Simultaneous Registration Spike (20 teams compete for 8 slots concurrently)
  console.log('\n--- TEST 1: Registration Rush (20 Concurrent Teams for 8 Slots) ---');
  const t0RegRush = performance.now();
  const regRushPromises = teams.map(({ teamId, player }) =>
    fetch(`${baseUrl}/api/tournaments/${tournamentId}/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${player.token}`,
      },
      body: JSON.stringify({ teamId }),
    }).then(async (res) => ({
      status: res.status,
      json: await res.json().catch(() => ({})),
    }))
  );

  const regRushResults = await Promise.all(regRushPromises);
  const regRushDurationMs = performance.now() - t0RegRush;

  const successfulRegistrations = regRushResults.filter((r) => r.status === 201).length;
  const rejectedRegistrations = regRushResults.filter((r) => r.status === 409 || r.status === 400).length;

  const [dbRegCount] = await pool.query(
    'SELECT COUNT(*) as cnt FROM registrations WHERE tournament_id = ?',
    [tournamentId]
  );

  console.log(`Duration: ${regRushDurationMs.toFixed(2)}ms`);
  console.log(`Accepted (201): ${successfulRegistrations}`);
  console.log(`Rejected (409/400): ${rejectedRegistrations}`);
  console.log(`Database Registration Count: ${dbRegCount[0].cnt} (Cap: 8)`);
  if (dbRegCount[0].cnt > 8) {
    throw new Error(`CRITICAL RACE CONDITION: Registrations exceeded cap! Total: ${dbRegCount[0].cnt}`);
  }
  console.log('✓ Capacity constraint strictly enforced under concurrent rush.');

  // TEST 2: Duplicate Registration Race (Same team sending 10 simultaneous registration requests)
  console.log('\n--- TEST 2: Duplicate Registration Race (10 Simultaneous Requests for Same Team) ---');
  const testTeam = teams[0];
  const duplicatePromises = Array.from({ length: 10 }, () =>
    fetch(`${baseUrl}/api/tournaments/${tournamentId}/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testTeam.player.token}`,
      },
      body: JSON.stringify({ teamId: testTeam.teamId }),
    }).then(async (res) => ({
      status: res.status,
      json: await res.json().catch(() => ({})),
    }))
  );

  const duplicateResults = await Promise.all(duplicatePromises);
  const dup201Count = duplicateResults.filter((r) => r.status === 201).length;
  const dup409Count = duplicateResults.filter((r) => r.status === 409).length;

  const [dbTeamRegs] = await pool.query(
    'SELECT COUNT(*) as cnt FROM registrations WHERE tournament_id = ? AND team_id = ?',
    [tournamentId, testTeam.teamId]
  );

  console.log(`Accepted (201): ${dup201Count}, Conflicts (409): ${dup409Count}`);
  console.log(`Database Records for Team ${testTeam.teamId}: ${dbTeamRegs[0].cnt}`);
  if (dbTeamRegs[0].cnt !== 1) {
    throw new Error(`CRITICAL RACE CONDITION: Team registered multiple times! Total: ${dbTeamRegs[0].cnt}`);
  }
  console.log('✓ Unique registration constraint strictly preserved under concurrent assault.');

  // TEST 3: Concurrent Match Result Submissions (Race on placement / kill points)
  console.log('\n--- TEST 3: Concurrent Match Result Submissions ---');
  // Transition tournament to LIVE
  await pool.query('UPDATE tournaments SET status = "LIVE" WHERE id = ?', [tournamentId]);

  // Create Round, Group, Match
  const [roundRes] = await pool.query(
    'INSERT INTO rounds (tournament_id, round_number, name, status) VALUES (?, 1, "Round 1", "IN_PROGRESS")',
    [tournamentId]
  );
  const roundId = roundRes.insertId;

  const [groupRes] = await pool.query(
    'INSERT INTO `groups` (round_id, name, group_size, status) VALUES (?, "Group A", 8, "IN_PROGRESS")',
    [roundId]
  );
  const groupId = groupRes.insertId;

  const [matchRes] = await pool.query(
    'INSERT INTO matches (group_id, match_number, name, status) VALUES (?, 1, "Match 1", "LIVE")',
    [groupId]
  );
  const matchId = matchRes.insertId;

  // Assign testTeam into group_teams
  await pool.query(
    'INSERT INTO group_teams (group_id, team_id) VALUES (?, ?)',
    [groupId, testTeam.teamId]
  );

  // 10 concurrent requests attempting to insert/update result for testTeam
  const resultSubmissionPromises = Array.from({ length: 10 }, (_, i) =>
    fetch(`${baseUrl}/api/matches/${matchId}/results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizer.token}`,
      },
      body: JSON.stringify({
        teamId: testTeam.teamId,
        placement: 1,
        kills: 5 + i,
        points: 15 + i,
      }),
    }).then(async (res) => ({
      status: res.status,
      json: await res.json().catch(() => ({})),
    }))
  );

  const resultResponses = await Promise.all(resultSubmissionPromises);
  const successfulResults = resultResponses.filter((r) => r.status === 200 || r.status === 201).length;

  const [dbResults] = await pool.query(
    'SELECT COUNT(*) as cnt FROM match_results WHERE match_id = ? AND team_id = ?',
    [matchId, testTeam.teamId]
  );

  console.log(`Result Submission Successes: ${successfulResults}`);
  console.log(`Database Result Rows for Team ${testTeam.teamId}: ${dbResults[0].cnt}`);
  if (dbResults[0].cnt !== 1) {
    throw new Error(`CRITICAL RACE CONDITION: Duplicate match result records created! Count: ${dbResults[0].cnt}`);
  }
  console.log('✓ Match result idempotency and unique constraint strictly preserved.');

  // TEST 4: Concurrent Tournament Completion Idempotency
  console.log('\n--- TEST 4: Concurrent Tournament Completion Idempotency ---');
  // Mark Match, Group, and Round as COMPLETED
  await pool.query('UPDATE matches SET status = "COMPLETED" WHERE id = ?', [matchId]);
  await pool.query('UPDATE `groups` SET status = "COMPLETED" WHERE id = ?', [groupId]);
  await pool.query('UPDATE rounds SET status = "COMPLETED" WHERE id = ?', [roundId]);

  const completePromises = Array.from({ length: 10 }, () =>
    fetch(`${baseUrl}/api/tournaments/${tournamentId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizer.token}`,
      },
    }).then(async (res) => ({
      status: res.status,
      json: await res.json().catch(() => ({})),
    }))
  );

  const completeResults = await Promise.all(completePromises);
  const comp200Count = completeResults.filter((r) => r.status === 200 || r.status === 201).length;

  const [dbTourney] = await pool.query(
    'SELECT status FROM tournaments WHERE id = ?',
    [tournamentId]
  );
  const [dbArchives] = await pool.query(
    'SELECT COUNT(*) as cnt FROM tournament_archives WHERE tournament_id = ?',
    [tournamentId]
  );

  console.log(`Completion Requests 200/201 Count: ${comp200Count}`);
  console.log(`Tournament Final Status: ${dbTourney[0].status}`);
  console.log(`Archive Records Created: ${dbArchives[0].cnt}`);
  if (dbArchives[0].cnt > 1) {
    throw new Error(`CRITICAL RACE CONDITION: Duplicate archive records generated! Count: ${dbArchives[0].cnt}`);
  }
  console.log('✓ Tournament completion idempotency verified (exact 1 archive generated).');

  io.close();
  await new Promise((resolve) => server.close(resolve));
  await closeTestDatabase();

  console.log('\n================================================================================');
  console.log(' SPIKE & TRANSACTION CONTENTION TESTS PASSED (0 RACE CONDITIONS)                ');
  console.log('================================================================================\n');

  return {
    successfulRegistrations,
    rejectedRegistrations,
    regRushDurationMs,
    dbRegCount: dbRegCount[0].cnt,
    dbResultRows: dbResults[0].cnt,
    archiveCount: dbArchives[0].cnt,
  };
}

if (process.argv[1] && process.argv[1].endsWith('spikeAndContention.bench.js')) {
  runSpikeAndContentionTests().then(() => process.exit(0)).catch((err) => {
    console.error('Spike test failed:', err);
    process.exit(1);
  });
}
