/**
 * EVOQ Phase 6.1 - 10,000+ Dataset Scale & SQL EXPLAIN Profiling Benchmark
 * 
 * Tests query latencies and execution plans under scale:
 * - 1,000+ Tournaments
 * - 500+ Teams
 * - 10,000+ Tournament Registrations
 * - Multiple Stages, Rounds, Groups, Matches, Group Standings
 * - Notifications, Announcements, Archives
 * - Full SQL EXPLAIN profiling for critical queries
 */

import http from 'node:http';
import request from 'supertest';
import { createApp } from '../../app.js';
import {
  setupTestDatabase,
  truncateAllTables,
  closeTestDatabase,
  createTestUser,
  getTestPool,
} from '../testEnvironment.js';

let app;
let server;
let pool;
let organizer;
let player;
let testTournamentId;
let testRoundId;
let testGroupId;

const results = {
  seeding: {},
  benchmarks: [],
  queryExplains: [],
};

function calculatePercentiles(arr) {
  if (arr.length === 0) return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const avg = +(sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2);
  const min = +sorted[0].toFixed(2);
  const max = +sorted[sorted.length - 1].toFixed(2);
  return { min, max, avg, p50: +p50.toFixed(2), p95: +p95.toFixed(2), p99: +p99.toFixed(2) };
}

async function runBenchmark(name, fn, iterations = 25) {
  const latencies = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn(i);
    const duration = performance.now() - start;
    latencies.push(duration);
  }

  const stats = calculatePercentiles(latencies);
  const benchResult = { name, iterations, ...stats };
  results.benchmarks.push(benchResult);
  console.log(`[BENCHMARK] ${name.padEnd(52)} | Avg: ${String(stats.avg).padStart(6)}ms | P50: ${String(stats.p50).padStart(6)}ms | P95: ${String(stats.p95).padStart(6)}ms | P99: ${String(stats.p99).padStart(6)}ms`);
  return benchResult;
}

async function profileSqlExplain(title, sqlQuery, params = []) {
  const [explainRows] = await pool.query(`EXPLAIN ${sqlQuery}`, params);
  const explainSummary = explainRows.map(r => ({
    table: r.table,
    type: r.type,
    possible_keys: r.possible_keys,
    key: r.key,
    key_len: r.key_len,
    rows: r.rows,
    filtered: r.filtered,
    Extra: r.Extra,
  }));

  results.queryExplains.push({
    title,
    query: sqlQuery,
    explain: explainSummary,
  });

  console.log(`[SQL EXPLAIN] ${title} -> Type: ${explainSummary[0]?.type || 'N/A'}, Key Used: ${explainSummary[0]?.key || 'NONE'}, Estimated Rows: ${explainSummary[0]?.rows || 0}`);
}

async function setupTestData() {
  console.log('--- Initializing 10K+ Scale Benchmark Environment ---');
  await setupTestDatabase();
  pool = getTestPool();
  await truncateAllTables();

  app = createApp();
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`Test server running on port ${port}`);

  organizer = await createTestUser({
    name: 'Scale 10K Organizer',
    email: 'scale10k_org@test.com',
    role: 'ORGANIZER',
  });

  player = await createTestUser({
    name: 'Scale 10K Player',
    email: 'scale10k_player@test.com',
    role: 'PLAYER',
  });
}

async function seed10kDataset() {
  console.log('\n--- Seeding 10,000+ Scale Dataset in Test MySQL Database ---');
  const t0 = performance.now();

  // 1. Seed 500 Teams
  console.log('Seeding 500 teams in batches of 100...');
  const teamIds = [];
  for (let b = 0; b < 5; b++) {
    const teamValues = [];
    for (let i = 1; i <= 100; i++) {
      const idx = b * 100 + i;
      teamValues.push(`('Scale 10K Team ${idx}', ${player.id})`);
    }
    await pool.query(`INSERT INTO teams (name, owner_id) VALUES ${teamValues.join(',')}`);
  }
  const [teams] = await pool.query(`SELECT id FROM teams WHERE name LIKE 'Scale 10K Team %'`);
  for (const t of teams) teamIds.push(t.id);

  // Add members
  const memberValues = teamIds.map(tid => `(${tid}, ${player.id}, 'OWNER')`);
  for (let i = 0; i < memberValues.length; i += 250) {
    const chunk = memberValues.slice(i, i + 250);
    await pool.query(`INSERT INTO team_members (team_id, user_id, role) VALUES ${chunk.join(',')}`);
  }

  const tTeams = performance.now();
  results.seeding.teams = { count: teamIds.length, timeMs: +(tTeams - t0).toFixed(2) };

  // 2. Seed 1,000 Tournaments
  console.log('Seeding 1,000 tournaments in batches of 200...');
  const statuses = ['DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'LIVE', 'COMPLETED'];
  const tournamentIds = [];

  for (let batch = 0; batch < 5; batch++) {
    const tValues = [];
    for (let i = 1; i <= 200; i++) {
      const idx = batch * 200 + i;
      const status = statuses[idx % statuses.length];
      const entryType = idx % 2 === 0 ? 'PAID' : 'FREE';
      const entryFee = entryType === 'PAID' ? 100.00 : 0.00;
      tValues.push(`(
        ${organizer.id}, 
        'Epic Scale Cup ${idx}', 
        'High volume stress tournament ${idx}', 
        DATE_ADD(NOW(), INTERVAL ${idx} DAY), 
        DATE_SUB(NOW(), INTERVAL 2 DAY), 
        DATE_ADD(NOW(), INTERVAL 5 DAY), 
        32, 
        1, 
        '${entryType}', 
        ${entryFee}, 
        '${status}'
      )`);
    }
    await pool.query(`
      INSERT INTO tournaments (
        organizer_id, name, description, tournament_date, 
        registration_start_at, registration_end_at, max_teams, 
        players_per_team, entry_type, entry_fee, status
      ) VALUES ${tValues.join(',')}
    `);
  }

  const [tourneys] = await pool.query(`SELECT id FROM tournaments WHERE name LIKE 'Epic Scale Cup %'`);
  for (const t of tourneys) tournamentIds.push(t.id);
  testTournamentId = tournamentIds[0];

  const tTourneys = performance.now();
  results.seeding.tournaments = { count: tournamentIds.length, timeMs: +(tTourneys - tTeams).toFixed(2) };

  // 3. Seed 10,000+ Tournament Registrations
  console.log('Seeding 10,000+ tournament registrations in chunks of 1,000...');
  const regValues = [];
  let regCount = 0;

  for (let i = 0; i < tournamentIds.length && regCount < 10500; i++) {
    const tourneyId = tournamentIds[i];
    // Distribute 10-12 team registrations per tournament
    const numRegs = (i % 3) + 10;
    for (let r = 0; r < numRegs && regCount < 10500; r++) {
      const teamId = teamIds[(i * 3 + r) % teamIds.length];
      const status = r % 5 === 0 ? 'PENDING' : 'VERIFIED';
      regValues.push(`(${tourneyId}, ${teamId}, '${status}', NOW())`);
      regCount++;
    }
  }

  for (let i = 0; i < regValues.length; i += 1000) {
    const chunk = regValues.slice(i, i + 1000);
    await pool.query(`INSERT IGNORE INTO registrations (tournament_id, team_id, status, submitted_at) VALUES ${chunk.join(',')}`);
  }

  const [actualRegs] = await pool.query(`SELECT count(*) as count FROM registrations`);
  const tRegs = performance.now();
  results.seeding.registrations = { count: actualRegs[0].count, timeMs: +(tRegs - tTourneys).toFixed(2) };

  // 4. Seed Competition Hierarchy (Rounds, Groups, Matches, Results) for active tournaments
  console.log('Seeding competition hierarchy (rounds, groups, matches)...');
  const [rRes] = await pool.query(
    'INSERT INTO rounds (tournament_id, round_number, name, status) VALUES (?, 1, "Quarter-Finals", "IN_PROGRESS")',
    [testTournamentId]
  );
  testRoundId = rRes.insertId;

  const [gRes] = await pool.query(
    'INSERT INTO `groups` (round_id, name, group_size, status) VALUES (?, "Group A", 16, "IN_PROGRESS")',
    [testRoundId]
  );
  testGroupId = gRes.insertId;

  // Assign 16 teams to Group A
  const groupTeamValues = [];
  for (let i = 0; i < 16; i++) {
    groupTeamValues.push(`(${testGroupId}, ${teamIds[i]})`);
  }
  await pool.query(`INSERT INTO group_teams (group_id, team_id) VALUES ${groupTeamValues.join(',')}`);

  // Seed 20 matches in Group A
  const matchValues = [];
  for (let m = 1; m <= 20; m++) {
    matchValues.push(`(${testGroupId}, ${m}, 'Match ${m}', 'COMPLETED')`);
  }
  await pool.query(`INSERT INTO matches (group_id, match_number, name, status) VALUES ${matchValues.join(',')}`);
  const [matches] = await pool.query(`SELECT id FROM matches WHERE group_id = ?`, [testGroupId]);

  // Seed match results & placements for standings calculation
  const resultValues = [];
  for (const match of matches) {
    for (let pos = 1; pos <= 16; pos++) {
      const kills = Math.floor(Math.random() * 10);
      const points = 20 - pos + kills;
      resultValues.push(`(${match.id}, ${teamIds[pos - 1]}, ${pos}, ${kills}, ${points}, ${organizer.id}, NOW())`);
    }
  }
  for (let i = 0; i < resultValues.length; i += 500) {
    const chunk = resultValues.slice(i, i + 500);
    await pool.query(`INSERT INTO match_results (match_id, team_id, placement, kills, points, uploaded_by, created_at) VALUES ${chunk.join(',')}`);
  }

  // 5. Seed 2,000 Notifications & Announcements
  console.log('Seeding 2,000 notifications...');
  const notifValues = [];
  for (let n = 1; n <= 2000; n++) {
    notifValues.push(`(${player.id}, ${testTournamentId}, 'SYSTEM', 'Important match reminder ${n}', NOW())`);
  }
  for (let i = 0; i < notifValues.length; i += 500) {
    const chunk = notifValues.slice(i, i + 500);
    await pool.query(`INSERT INTO notifications (user_id, tournament_id, type, content, created_at) VALUES ${chunk.join(',')}`);
  }

  // 6. Seed Completed Tournament Archives
  console.log('Seeding tournament completion archives...');
  const archiveValues = [];
  for (let a = 1; a <= 50; a++) {
    archiveValues.push(`(
      ${tournamentIds[a]}, 
      'Completed Cup Archive ${a}', 
      NOW(), 
      32, 
      '{"entries": [{"teamId": 1, "points": 50}]}', 
      '[]', 
      '{"champion": "Scale Team 1"}', 
      '{"totalTeams": 32}'
    )`);
  }
  await pool.query(`INSERT INTO tournament_archives (tournament_id, tournament_name, completed_at, registration_count, final_leaderboard_json, qualified_teams_json, winners_json, summary_json) VALUES ${archiveValues.join(',')}`);

  const tTotal = performance.now();
  results.seeding.totalSeedingTimeMs = +(tTotal - t0).toFixed(2);
  console.log(`\n10,000+ Seeding Complete in ${results.seeding.totalSeedingTimeMs}ms:`);
  console.log(`- Tournaments:   ${tournamentIds.length}`);
  console.log(`- Teams:         ${teamIds.length}`);
  console.log(`- Registrations: ${actualRegs[0].count}`);
  console.log(`- Match Results: ${resultValues.length}`);
  console.log(`- Notifications: 2,000`);
  console.log(`- Archives:      50\n`);
}

async function executeScaleBenchmarks() {
  console.log('--- Executing 10,000+ Dataset Query & API Benchmarks ---');

  // Benchmark 1: Public Tournaments Listing (Page 1)
  await runBenchmark('Public Tournaments Listing - Page 1 (Limit 10)', async () => {
    await request(app).get('/api/tournaments?page=1&limit=10').expect(200);
  });

  // Benchmark 2: Deep Pagination (Page 50)
  await runBenchmark('Public Tournaments Deep Pagination - Page 50 (Limit 20)', async () => {
    await request(app).get('/api/tournaments?page=50&limit=20').expect(200);
  });

  // Benchmark 3: Filter by Status (REGISTRATION_OPEN)
  await runBenchmark('Filter Tournaments by Status (REGISTRATION_OPEN)', async () => {
    await request(app).get('/api/tournaments?status=REGISTRATION_OPEN&page=1&limit=20').expect(200);
  });

  // Benchmark 4: Search across 1,000+ Tournaments
  await runBenchmark('Search Tournaments ("Epic Scale Cup 5")', async () => {
    await request(app).get('/api/tournaments?search=Epic%20Scale%20Cup%205&page=1&limit=10').expect(200);
  });

  // Benchmark 5: Organizer Dashboard (1,000 Tournaments Created)
  await runBenchmark('Organizer Dashboard (1,000 Tournaments)', async () => {
    await request(app).get('/api/organizer/dashboard').set('Authorization', `Bearer ${organizer.token}`).expect(200);
  });

  // Benchmark 6: Tournament Registrations Listing (10,000+ Reg Table)
  await runBenchmark('Tournament Registrations List (Verified Filter)', async () => {
    await request(app)
      .get(`/api/tournaments/${testTournamentId}/registrations?status=VERIFIED`)
      .set('Authorization', `Bearer ${organizer.token}`)
      .expect(200);
  });

  // Benchmark 7: Group Standings / Leaderboard Aggregation
  await runBenchmark('Group Standings & Match Results Aggregation', async () => {
    await pool.query(
      `SELECT mr.team_id, t.name as team_name, 
              SUM(mr.points) as total_points, 
              SUM(mr.kills) as total_kills,
              COUNT(mr.id) as matches_played
       FROM match_results mr
       JOIN matches m ON m.id = mr.match_id
       JOIN teams t ON t.id = mr.team_id
       WHERE m.group_id = ?
       GROUP BY mr.team_id, t.name
       ORDER BY total_points DESC, total_kills DESC`,
      [testGroupId]
    );
  });

  // Benchmark 8: Notifications Retrieval (2,000 Notification Table)
  await runBenchmark('Notifications Listing for Player', async () => {
    await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${player.token}`)
      .expect(200);
  });

  // Benchmark 9: Tournament Archive / History Retrieval
  await runBenchmark('Historical Tournament Archives Retrieval', async () => {
    await request(app)
      .get('/api/history')
      .set('Authorization', `Bearer ${player.token}`)
      .expect(200);
  });
}

async function executeSqlExplains() {
  console.log('\n--- Executing SQL EXPLAIN Profiling on Critical Queries ---');

  // Explain 1: Tournament Listing Filter & Sort
  await profileSqlExplain(
    'Tournaments Filter by Status & Sort by Date',
    `SELECT id, name, tournament_date, status, entry_type, entry_fee 
     FROM tournaments 
     WHERE status = 'REGISTRATION_OPEN' 
     ORDER BY tournament_date ASC 
     LIMIT 20`
  );

  // Explain 2: Tournament Registrations with Team Join
  await profileSqlExplain(
    'Tournament Registrations with Team Details',
    `SELECT r.id, r.tournament_id, r.team_id, r.status, t.name as team_name, t.owner_id 
     FROM registrations r 
     JOIN teams t ON t.id = r.team_id 
     WHERE r.tournament_id = ? AND r.status = 'VERIFIED' 
     LIMIT 50`,
    [testTournamentId]
  );

  // Explain 3: Group Standings Aggregation
  await profileSqlExplain(
    'Group Standings & Aggregate Scoring',
    `SELECT mr.team_id, t.name as team_name, SUM(mr.points) as total_points, SUM(mr.kills) as total_kills 
     FROM match_results mr 
     JOIN matches m ON m.id = mr.match_id 
     JOIN teams t ON t.id = mr.team_id 
     WHERE m.group_id = ? 
     GROUP BY mr.team_id, t.name 
     ORDER BY total_points DESC`,
    [testGroupId]
  );

  // Explain 4: Organizer Dashboard Mine Listing
  await profileSqlExplain(
    'Organizer Tournament Retrieval',
    `SELECT id, name, status, tournament_date, max_teams 
     FROM tournaments 
     WHERE organizer_id = ? 
     ORDER BY created_at DESC 
     LIMIT 50`,
    [organizer.id]
  );
}

async function cleanupTestData() {
  console.log('\n--- Cleaning up 10K Scale Benchmark Data ---');
  try {
    await truncateAllTables();
    console.log('Cleanup completed successfully.');
  } catch (err) {
    console.warn('Cleanup notice:', err.message);
  }

  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
  await closeTestDatabase();
}

export async function runScale10kBenchmark() {
  try {
    await setupTestData();
    await seed10kDataset();
    await executeScaleBenchmarks();
    await executeSqlExplains();
    await cleanupTestData();

    console.log('\n================================================================================');
    console.log(' EVOQ PHASE 6.1: 10,000+ SCALE BENCHMARK & EXPLAIN PROFILING COMPLETE           ');
    console.log('================================================================================');
    console.log(JSON.stringify(results, null, 2));
    return results;
  } catch (err) {
    console.error('Scale 10k benchmark failed:', err);
    try { await cleanupTestData(); } catch (_) {}
    throw err;
  }
}

if (process.argv[1]?.endsWith('scale10k.bench.js')) {
  runScale10kBenchmark()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
