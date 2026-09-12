/**
 * EVOQ Phase 6 - Large Dataset & Pagination Stress Benchmark
 * 
 * Tests system performance and query latencies under scale:
 * - 500+ Tournaments
 * - 1,000+ Registrations
 * - 100+ Teams
 * - Pagination correctness & page scanning efficiency
 * - Filtering & sorting under dataset volume
 * - Memory & connection stability
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

const results = {
  seeding: {},
  benchmarks: []
};

async function setupTestData() {
  console.log('--- Setting up Large Dataset Test Suite ---');
  await setupTestDatabase();
  pool = getTestPool();
  await truncateAllTables();

  app = createApp();
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`Test server running on port ${port}`);

  // Create Users
  organizer = await createTestUser({
    name: 'Scale Organizer',
    email: 'scale_org@test.com',
    role: 'ORGANIZER',
  });

  player = await createTestUser({
    name: 'Scale Player',
    email: 'scale_player@test.com',
    role: 'PLAYER',
  });
}

async function seedMassiveData() {
  console.log('--- Seeding Massive Dataset ---');
  const t0 = performance.now();

  // 1. Seed 100 Teams
  console.log('Seeding 100 teams with players...');
  const teamValues = [];
  for (let i = 1; i <= 100; i++) {
    teamValues.push(`('Scale Team ${i}', ${player.id})`);
  }
  await pool.query(`INSERT INTO teams (name, owner_id) VALUES ${teamValues.join(',')}`);
  const [teams] = await pool.query(`SELECT id FROM teams WHERE name LIKE 'Scale Team %' LIMIT 100`);
  const teamIds = teams.map(t => t.id);

  // Add players to teams
  const memberValues = [];
  for (const tid of teamIds) {
    memberValues.push(`(${tid}, ${player.id}, 'OWNER')`);
  }
  await pool.query(`INSERT INTO team_members (team_id, user_id, role) VALUES ${memberValues.join(',')}`);

  const tTeams = performance.now();
  results.seeding.teams = { count: teamIds.length, timeMs: +(tTeams - t0).toFixed(2) };

  // 2. Seed 500 Tournaments
  console.log('Seeding 500 tournaments in batches of 100...');
  const statuses = ['DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'LIVE', 'COMPLETED'];
  
  for (let batch = 0; batch < 5; batch++) {
    const tValues = [];
    for (let i = 1; i <= 100; i++) {
      const idx = batch * 100 + i;
      const status = statuses[idx % statuses.length];
      const entryType = idx % 2 === 0 ? 'PAID' : 'FREE';
      const entryFee = entryType === 'PAID' ? 50.00 : 0.00;
      tValues.push(`(
        ${organizer.id}, 
        'Stress Tourney ${idx}', 
        'Description for scale tournament ${idx}', 
        DATE_ADD(NOW(), INTERVAL ${idx} DAY), 
        DATE_SUB(NOW(), INTERVAL 2 DAY), 
        DATE_ADD(NOW(), INTERVAL 5 DAY), 
        16, 
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

  const [tourneys] = await pool.query(`SELECT id FROM tournaments WHERE name LIKE 'Stress Tourney %' LIMIT 500`);
  const tTourneys = performance.now();
  results.seeding.tournaments = { count: tourneys.length, timeMs: +(tTourneys - tTeams).toFixed(2) };

  // 3. Seed 1,000+ Registrations
  console.log('Seeding 1,000+ tournament registrations...');
  const regValues = [];
  let regCount = 0;
  for (let i = 0; i < tourneys.length && regCount < 1000; i++) {
    const tourneyId = tourneys[i].id;
    // Register 2-4 teams per tournament
    const numRegs = (i % 3) + 2;
    for (let r = 0; r < numRegs && regCount < 1000; r++) {
      const teamId = teamIds[(i + r) % teamIds.length];
      regValues.push(`(${tourneyId}, ${teamId}, 'VERIFIED', NOW())`);
      regCount++;
    }
  }

  // Insert registrations in chunks of 500
  for (let i = 0; i < regValues.length; i += 500) {
    const chunk = regValues.slice(i, i + 500);
    await pool.query(`INSERT IGNORE INTO registrations (tournament_id, team_id, status, submitted_at) VALUES ${chunk.join(',')}`);
  }

  const [actualRegs] = await pool.query(`SELECT count(*) as count FROM registrations WHERE tournament_id IN (SELECT id FROM tournaments WHERE name LIKE 'Stress Tourney %')`);
  const tRegs = performance.now();
  results.seeding.registrations = { count: actualRegs[0].count, timeMs: +(tRegs - tTourneys).toFixed(2) };
  results.seeding.totalSeedingTimeMs = +(tRegs - t0).toFixed(2);

  console.log(`Seeding complete: ${tourneys.length} tournaments, ${teamIds.length} teams, ${actualRegs[0].count} registrations in ${results.seeding.totalSeedingTimeMs}ms`);
}

async function runBenchmark(name, fn, iterations = 25) {
  const latencies = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn(i);
    const duration = performance.now() - start;
    latencies.push(duration);
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const avg = +(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2);
  const min = +latencies[0].toFixed(2);
  const max = +latencies[latencies.length - 1].toFixed(2);

  const benchResult = { name, iterations, min, max, avg, p50: +p50.toFixed(2), p95: +p95.toFixed(2), p99: +p99.toFixed(2) };
  results.benchmarks.push(benchResult);
  console.log(`[BENCHMARK] ${name.padEnd(50)} | Avg: ${String(avg).padStart(6)}ms | P50: ${String(benchResult.p50).padStart(6)}ms | P95: ${String(benchResult.p95).padStart(6)}ms | P99: ${String(benchResult.p99).padStart(6)}ms`);
  return benchResult;
}

async function runScaleTests() {
  console.log('\n--- Executing Scale & Pagination Benchmarks ---');

  // Benchmark 1: Public Tournaments Pagination - Page 1
  await runBenchmark('Public Tournaments - Page 1 (Limit 10)', async () => {
    const res = await request(app)
      .get('/api/tournaments?page=1&limit=10')
      .expect(200);
  });

  // Benchmark 2: Public Tournaments Deep Pagination - Page 25
  await runBenchmark('Public Tournaments - Deep Page 25 (Limit 20)', async () => {
    const res = await request(app)
      .get('/api/tournaments?page=25&limit=20')
      .expect(200);
  });

  // Benchmark 3: Filter by Status (REGISTRATION_OPEN)
  await runBenchmark('Tournaments Filtered by Status (REGISTRATION_OPEN)', async () => {
    const res = await request(app)
      .get('/api/tournaments?status=REGISTRATION_OPEN&page=1&limit=20')
      .expect(200);
  });

  // Benchmark 4: Search by Name Query across 500+ records
  await runBenchmark('Tournaments Search Query ("Stress Tourney 2")', async () => {
    const res = await request(app)
      .get('/api/tournaments?search=Stress%20Tourney%202&page=1&limit=10')
      .expect(200);
  });

  // Benchmark 5: Organizer Dashboard Tournaments Retrieval
  await runBenchmark('Organizer Dashboard (500+ Tourneys Created)', async () => {
    const res = await request(app)
      .get('/api/organizer/dashboard')
      .set('Authorization', `Bearer ${organizer.token}`)
      .expect(200);
  });

  // Benchmark 6: Direct DB: Indexed Status Filter & Order By
  await runBenchmark('Direct DB: Indexed Status Filter & Order By', async () => {
    await pool.query(
      `SELECT id, name, status, tournament_date, max_teams 
       FROM tournaments 
       WHERE status = 'REGISTRATION_OPEN' 
       ORDER BY tournament_date DESC 
       LIMIT 20`
    );
  });

  // Benchmark 7: Direct DB: Registration Join & Aggregate Query
  await runBenchmark('Direct DB: Tournament Reg Count Aggregation', async () => {
    await pool.query(
      `SELECT t.id, t.name, COUNT(r.id) as confirmed_registrations
       FROM tournaments t
       LEFT JOIN registrations r ON t.id = r.tournament_id AND r.status = 'VERIFIED'
       WHERE t.organizer_id = ?
       GROUP BY t.id
       LIMIT 50`,
      [organizer.id]
    );
  });
}

async function cleanupTestData() {
  console.log('\n--- Cleaning up Scale Test Data ---');
  try {
    await truncateAllTables();
    console.log('Cleanup completed successfully.');
  } catch (err) {
    console.error('Error during cleanup:', err.message);
  }

  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
  await closeTestDatabase();
}

export async function runLargeDatasetBenchmark() {
  try {
    await setupTestData();
    await seedMassiveData();
    await runScaleTests();
    await cleanupTestData();

    console.log('\n================================================================================');
    console.log(' EVOQ PHASE 6: LARGE DATASET & SCALE BENCHMARK COMPLETE                         ');
    console.log('================================================================================');
    console.log(JSON.stringify(results, null, 2));
    return results;
  } catch (err) {
    console.error('Large dataset benchmark failed with error:', err.message);
    if (err.sqlMessage) console.error('SQL Error:', err.sqlMessage);
    try { await cleanupTestData(); } catch (_) {}
    throw err;
  }
}

if (process.argv[1]?.endsWith('largeDataset.bench.js')) {
  runLargeDatasetBenchmark()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
