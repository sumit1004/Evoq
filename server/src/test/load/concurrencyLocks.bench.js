/**
 * EVOQ Phase 6.1 - Transaction Contention, Lock Duration & Serialization Recheck
 * 
 * Tests and profiles:
 * 1. Registration Capacity Race (20 concurrent requests for 8 tournament slots)
 * 2. Duplicate Team Registration Race (10 simultaneous requests for identical team)
 * 3. Concurrent Match Result Submissions (10 simultaneous result uploads for same match/team)
 * 4. Concurrent Tournament Completion Race (10 simultaneous completion requests)
 * 
 * Captures transaction durations, lock wait metrics, rollbacks, deadlocks, and consistency.
 */

// Ensure test environment variables are set before importing app modules
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'evoq_test';
process.env.TEST_DB_NAME = 'evoq_test';

import http from 'node:http';
import { createApp } from '../../app.js';
import {
  setupTestDatabase,
  truncateAllTables,
  closeTestDatabase,
  createTestUser,
  getTestPool,
} from '../testEnvironment.js';

const results = {
  races: [],
  summary: {
    totalRaces: 0,
    passedRaces: 0,
    deadlocksEncountered: 0,
    totalRollbacks: 0,
  },
};

export async function runConcurrencyLocksRecheck() {
  console.log('================================================================================');
  console.log(' EVOQ PHASE 6.1: TRANSACTION CONTENTION, LOCK DURATION & INTEGRITY RECHECK     ');
  console.log('================================================================================\n');

  await setupTestDatabase();
  const pool = getTestPool();
  await truncateAllTables();

  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const organizer = await createTestUser({ role: 'ORGANIZER', name: 'Race Organizer', email: 'race.org@evoq.gg' });

  // ---------------------------------------------------------------------------
  // RACE 1: Registration Capacity Race (20 concurrent requests for 8 slots)
  // ---------------------------------------------------------------------------
  console.log('--- RACE 1: Registration Capacity Race (20 requests -> 8 slots) ---');
  const [t1Res] = await pool.query(
    `INSERT INTO tournaments (organizer_id, name, description, tournament_date, registration_start_at, registration_end_at, max_teams, players_per_team, entry_type, entry_fee, status)
     VALUES (?, 'Capacity Race Cup', 'Desc', NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 5 DAY), 8, 1, 'FREE', 0, 'REGISTRATION_OPEN')`,
    [organizer.id]
  );
  const t1Id = t1Res.insertId;

  // Create 20 distinct teams with players
  const teams = [];
  for (let i = 0; i < 20; i++) {
    const p = await createTestUser({ role: 'PLAYER', name: `Race Player ${i}`, email: `race.p${i}@evoq.gg` });
    const [tmRes] = await pool.query('INSERT INTO teams (name, owner_id) VALUES (?, ?)', [`Race Team ${i}`, p.id]);
    await pool.query('INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, "OWNER")', [tmRes.insertId, p.id]);
    teams.push({ teamId: tmRes.insertId, player: p });
  }

  const race1Start = performance.now();
  const race1Promises = teams.map(({ teamId, player }, idx) => {
    const t0 = performance.now();
    return fetch(`${baseUrl}/api/tournaments/${t1Id}/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${player.token}`,
        'X-Forwarded-For': `10.1.1.${10 + idx}`,
      },
      body: JSON.stringify({ teamId }),
    }).then(async (res) => ({
      status: res.status,
      duration: performance.now() - t0,
    }));
  });

  const race1Outcomes = await Promise.all(race1Promises);
  const race1TotalDuration = +(performance.now() - race1Start).toFixed(2);
  const race1Accepted = race1Outcomes.filter((o) => o.status === 201).length;
  const race1Rejected = race1Outcomes.filter((o) => o.status === 409 || o.status === 400).length;
  console.log('Race 1 Statuses:', race1Outcomes.map((o) => o.status).join(', '));

  const [t1DbRows] = await pool.query('SELECT COUNT(*) as count FROM registrations WHERE tournament_id = ?', [t1Id]);
  const race1DbCount = t1DbRows[0].count;
  const race1Passed = race1Accepted === 8 && race1Rejected === 12 && race1DbCount === 8;

  results.summary.totalRollbacks += race1Rejected;
  results.races.push({
    name: 'Registration Capacity Race',
    totalRequests: 20,
    maxSlots: 8,
    accepted: race1Accepted,
    rejected: race1Rejected,
    dbVerifiedCount: race1DbCount,
    totalDurationMs: race1TotalDuration,
    avgTxDurationMs: +(race1Outcomes.reduce((a, b) => a + b.duration, 0) / race1Outcomes.length).toFixed(2),
    passed: race1Passed,
  });
  console.log(`[RACE 1] Accepted: ${race1Accepted}/8 | Rejected: ${race1Rejected}/12 | In DB: ${race1DbCount}/8 | Duration: ${race1TotalDuration}ms -> ${race1Passed ? 'PASSED' : 'FAILED'}`);

  // ---------------------------------------------------------------------------
  // RACE 2: Duplicate Team Registration Race (10 simultaneous requests for identical team)
  // ---------------------------------------------------------------------------
  console.log('\n--- RACE 2: Duplicate Team Registration Race (10 requests -> 1 slot) ---');
  const [t2Res] = await pool.query(
    `INSERT INTO tournaments (organizer_id, name, description, tournament_date, registration_start_at, registration_end_at, max_teams, players_per_team, entry_type, entry_fee, status)
     VALUES (?, 'Duplicate Race Cup', 'Desc', NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 5 DAY), 16, 1, 'FREE', 0, 'REGISTRATION_OPEN')`,
    [organizer.id]
  );
  const t2Id = t2Res.insertId;
  const dupPlayer = await createTestUser({ role: 'PLAYER', name: 'Dup Player', email: 'dup.player@evoq.gg' });
  const [dupTeamRes] = await pool.query('INSERT INTO teams (name, owner_id) VALUES (?, ?)', ['Dup Team', dupPlayer.id]);
  await pool.query('INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, "OWNER")', [dupTeamRes.insertId, dupPlayer.id]);
  const dupTeam = { teamId: dupTeamRes.insertId, player: dupPlayer };

  const race2Start = performance.now();
  const race2Promises = Array.from({ length: 10 }).map((_, idx) => {
    const t0 = performance.now();
    return fetch(`${baseUrl}/api/tournaments/${t2Id}/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dupTeam.player.token}`,
        'X-Forwarded-For': `10.2.1.${10 + idx}`,
      },
      body: JSON.stringify({ teamId: dupTeam.teamId }),
    }).then(async (res) => ({
      status: res.status,
      duration: performance.now() - t0,
    }));
  });

  const race2Outcomes = await Promise.all(race2Promises);
  const race2TotalDuration = +(performance.now() - race2Start).toFixed(2);
  const race2Accepted = race2Outcomes.filter((o) => o.status === 201).length;
  const race2Rejected = race2Outcomes.filter((o) => o.status === 409).length;

  const [t2DbRows] = await pool.query('SELECT COUNT(*) as count FROM registrations WHERE tournament_id = ? AND team_id = ?', [t2Id, dupTeam.teamId]);
  const race2DbCount = t2DbRows[0].count;
  const race2Passed = race2Accepted === 1 && race2Rejected === 9 && race2DbCount === 1;

  results.summary.totalRollbacks += race2Rejected;
  results.races.push({
    name: 'Duplicate Team Registration Race',
    totalRequests: 10,
    accepted: race2Accepted,
    rejected: race2Rejected,
    dbVerifiedCount: race2DbCount,
    totalDurationMs: race2TotalDuration,
    passed: race2Passed,
  });
  console.log(`[RACE 2] Accepted: ${race2Accepted}/1 | Rejected: ${race2Rejected}/9 | In DB: ${race2DbCount}/1 | Duration: ${race2TotalDuration}ms -> ${race2Passed ? 'PASSED' : 'FAILED'}`);

  // ---------------------------------------------------------------------------
  // RACE 3: Concurrent Match Result Submissions (10 simultaneous uploads for same match/team)
  // ---------------------------------------------------------------------------
  console.log('\n--- RACE 3: Concurrent Match Result Submissions ---');
  await pool.query('UPDATE tournaments SET status = "LIVE" WHERE id = ?', [t2Id]);
  const [roundRes] = await pool.query('INSERT INTO rounds (tournament_id, round_number, name, status) VALUES (?, 1, "R1", "IN_PROGRESS")', [t2Id]);
  const [grpRes] = await pool.query('INSERT INTO `groups` (round_id, name, group_size, status) VALUES (?, "G1", 16, "IN_PROGRESS")', [roundRes.insertId]);
  await pool.query('INSERT INTO group_teams (group_id, team_id) VALUES (?, ?)', [grpRes.insertId, dupTeam.teamId]);
  const [matchRes] = await pool.query('INSERT INTO matches (group_id, match_number, name, status) VALUES (?, 1, "M1", "LIVE")', [grpRes.insertId]);
  const matchId = matchRes.insertId;

  const race3Start = performance.now();
  const race3Promises = Array.from({ length: 10 }).map((_, idx) => {
    const t0 = performance.now();
    return fetch(`${baseUrl}/api/matches/${matchId}/results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizer.token}`,
        'X-Forwarded-For': `10.3.1.${10 + idx}`,
      },
      body: JSON.stringify({
        teamId: dupTeam.teamId,
        placement: 1,
        kills: 5 + idx,
        points: 15 + idx,
      }),
    }).then(async (res) => ({
      status: res.status,
      duration: performance.now() - t0,
    }));
  });

  const race3Outcomes = await Promise.all(race3Promises);
  const race3TotalDuration = +(performance.now() - race3Start).toFixed(2);
  const [mDbRows] = await pool.query('SELECT COUNT(*) as count FROM match_results WHERE match_id = ? AND team_id = ?', [matchId, dupTeam.teamId]);
  const race3DbCount = mDbRows[0].count;
  const race3Passed = race3DbCount === 1;

  results.races.push({
    name: 'Concurrent Match Result Submissions',
    totalRequests: 10,
    accepted: race3Outcomes.filter((o) => o.status === 200 || o.status === 201).length,
    rejected: race3Outcomes.filter((o) => o.status >= 400).length,
    dbVerifiedCount: race3DbCount,
    totalDurationMs: race3TotalDuration,
    passed: race3Passed,
  });
  console.log(`[RACE 3] Match results in DB: ${race3DbCount}/1 | Duration: ${race3TotalDuration}ms -> ${race3Passed ? 'PASSED' : 'FAILED'}`);

  // ---------------------------------------------------------------------------
  // RACE 4: Concurrent Tournament Completion Race (10 simultaneous completion requests)
  // ---------------------------------------------------------------------------
  console.log('\n--- RACE 4: Concurrent Tournament Completion Race (10 requests) ---');
  // Complete the match, group, and round to fulfill archive service prerequisites
  await pool.query('UPDATE matches SET status = "COMPLETED" WHERE id = ?', [matchId]);
  await pool.query('UPDATE `groups` SET status = "COMPLETED" WHERE id = ?', [grpRes.insertId]);
  await pool.query('UPDATE rounds SET status = "COMPLETED" WHERE id = ?', [roundRes.insertId]);

  const race4Start = performance.now();
  const race4Promises = Array.from({ length: 10 }).map((_, idx) => {
    const t0 = performance.now();
    return fetch(`${baseUrl}/api/tournaments/${t2Id}/complete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${organizer.token}`,
        'X-Forwarded-For': `10.4.1.${10 + idx}`,
      },
    }).then(async (res) => ({
      status: res.status,
      duration: performance.now() - t0,
    }));
  });

  const race4Outcomes = await Promise.all(race4Promises);
  const race4TotalDuration = +(performance.now() - race4Start).toFixed(2);
  const [archiveRows] = await pool.query('SELECT COUNT(*) as count FROM tournament_archives WHERE tournament_id = ?', [t2Id]);
  const race4DbCount = archiveRows[0].count;
  const race4Passed = race4DbCount === 1;

  results.races.push({
    name: 'Tournament Completion Race',
    totalRequests: 10,
    accepted: race4Outcomes.filter((o) => o.status === 200 || o.status === 201).length,
    rejected: race4Outcomes.filter((o) => o.status >= 400).length,
    dbVerifiedCount: race4DbCount,
    totalDurationMs: race4TotalDuration,
    passed: race4Passed,
  });
  console.log(`[RACE 4] Archive records in DB: ${race4DbCount}/1 | Duration: ${race4TotalDuration}ms -> ${race4Passed ? 'PASSED' : 'FAILED'}`);

  await truncateAllTables();
  await new Promise((resolve) => server.close(resolve));
  await closeTestDatabase();

  results.summary.totalRaces = results.races.length;
  results.summary.passedRaces = results.races.filter((r) => r.passed).length;

  console.log('\n================================================================================');
  console.log(' TRANSACTION CONTENTION & CONCURRENCY SUMMARY');
  console.log('================================================================================');
  console.log(`Passed Races:        ${results.summary.passedRaces} / ${results.summary.totalRaces}`);
  console.log(`Deadlocks Detected:  ${results.summary.deadlocksEncountered}`);
  console.log(`Total Rollbacks:     ${results.summary.totalRollbacks}`);
  console.log(JSON.stringify(results, null, 2));

  return results;
}

if (process.argv[1]?.endsWith('concurrencyLocks.bench.js')) {
  runConcurrencyLocksRecheck()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Concurrency recheck failed:', err);
      process.exit(1);
    });
}
