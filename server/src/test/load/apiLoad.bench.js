import http from 'node:http';
import { Server } from 'socket.io';
import { createApp } from '../../app.js';
import { registerSocketHandlers } from '../../sockets/index.js';
import { config } from '../../config/env.js';
import {
  setupTestDatabase,
  truncateAllTables,
  closeTestDatabase,
  createTestUser,
  getTestPool,
} from '../testEnvironment.js';

function computePercentiles(latencies) {
  if (latencies.length === 0) return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const getP = (p) => sorted[Math.floor(sorted.length * (p / 100))] || sorted[sorted.length - 1];
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    p50: Number(getP(50).toFixed(2)),
    p95: Number(getP(95).toFixed(2)),
    p99: Number(getP(99).toFixed(2)),
    min: Number(sorted[0].toFixed(2)),
    max: Number(sorted[sorted.length - 1].toFixed(2)),
    avg: Number((sum / sorted.length).toFixed(2)),
  };
}

async function runConcurrentWorkers({ workerCount, totalRequests, taskFn }) {
  const latencies = [];
  let errorCount = 0;
  let completed = 0;
  const t0 = performance.now();

  const requestsPerWorker = Math.floor(totalRequests / workerCount);

  async function worker(workerId) {
    for (let i = 0; i < requestsPerWorker; i++) {
      const tStart = performance.now();
      try {
        const ok = await taskFn(workerId, i);
        const duration = performance.now() - tStart;
        if (ok) {
          latencies.push(duration);
        } else {
          errorCount++;
        }
      } catch (err) {
        errorCount++;
      }
      completed++;
    }
  }

  const workers = Array.from({ length: workerCount }, (_, i) => worker(i));
  await Promise.all(workers);

  const totalTimeMs = performance.now() - t0;
  const throughput = Number(((completed / totalTimeMs) * 1000).toFixed(2));
  const stats = computePercentiles(latencies);

  return {
    concurrency: workerCount,
    totalRequests: completed,
    successCount: latencies.length,
    errorCount,
    errorRate: Number(((errorCount / completed) * 100).toFixed(2)),
    totalTimeMs: Number(totalTimeMs.toFixed(2)),
    throughputReqSec: throughput,
    ...stats,
  };
}

export async function runApiLoadTests() {
  console.log('================================================================================');
  console.log(' EVOQ PHASE 6: API CONCURRENT LOAD TESTING (10, 25, 50, 100 USERS)             ');
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

  // Seed baseline users & tournaments
  console.log('Seeding load test users, organizations, and tournaments...');
  const organizer = await createTestUser({ role: 'ORGANIZER', name: 'Load Organizer', email: 'load.org@evoq.gg' });
  const [orgRes] = await pool.query(
    'INSERT INTO organizations (name, slug, owner_id) VALUES (?, ?, ?)',
    ['Load Org', 'load-org', organizer.id]
  );

  const players = [];
  for (let i = 0; i < 20; i++) {
    const p = await createTestUser({ role: 'PLAYER', name: `Load Player ${i}`, email: `load.player${i}@evoq.gg` });
    players.push(p);
  }

  // Insert 20 active tournaments
  const tournamentIds = [];
  for (let i = 1; i <= 20; i++) {
    const [tRes] = await pool.query(
      `INSERT INTO tournaments (organizer_id, name, description, tournament_date, registration_start_at, registration_end_at, max_teams, players_per_team, entry_type, entry_fee, status)
       VALUES (?, ?, 'High concurrency load test tournament', DATE_ADD(NOW(), INTERVAL 10 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 5 DAY), 32, 4, 'FREE', 0, 'REGISTRATION_OPEN')`,
      [organizer.id, `Load Cup ${i}`]
    );
    tournamentIds.push(tRes.insertId);
  }

  const concurrencyTiers = [10, 25, 50, 100];
  const resultsTable = [];

  // Endpoints to benchmark under concurrency
  const suites = [
    {
      name: 'Public Tournament Directory (GET /api/tournaments)',
      task: async (workerId) => {
        const res = await fetch(`${baseUrl}/api/tournaments?page=1&limit=10`);
        return res.status === 200;
      },
    },
    {
      name: 'User Authentication (POST /api/auth/login)',
      task: async (workerId) => {
        const idx = workerId % players.length;
        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: `load.player${idx}@evoq.gg`, password: 'Password123!' }),
        });
        return res.status === 200;
      },
    },
    {
      name: 'Authenticated Player Dashboard (GET /api/player/dashboard)',
      task: async (workerId) => {
        const idx = workerId % players.length;
        const res = await fetch(`${baseUrl}/api/player/dashboard`, {
          headers: { Authorization: `Bearer ${players[idx].token}` },
        });
        return res.status === 200;
      },
    },
    {
      name: 'Authenticated Tournament Details (GET /api/tournaments/:id)',
      task: async (workerId) => {
        const idx = workerId % players.length;
        const tourneyId = tournamentIds[workerId % tournamentIds.length];
        const res = await fetch(`${baseUrl}/api/tournaments/${tourneyId}`, {
          headers: { Authorization: `Bearer ${players[idx].token}` },
        });
        return res.status === 200;
      },
    },
    {
      name: 'Organizer Dashboard & Management (GET /api/organizer/dashboard)',
      task: async () => {
        const res = await fetch(`${baseUrl}/api/organizer/dashboard`, {
          headers: { Authorization: `Bearer ${organizer.token}` },
        });
        return res.status === 200;
      },
    },
    {
      name: 'Notifications Listing (GET /api/notifications)',
      task: async (workerId) => {
        const idx = workerId % players.length;
        const res = await fetch(`${baseUrl}/api/notifications`, {
          headers: { Authorization: `Bearer ${players[idx].token}` },
        });
        return res.status === 200;
      },
    },
  ];

  for (const suite of suites) {
    console.log(`\nTesting: ${suite.name}`);
    console.log('--------------------------------------------------------------------------------');
    console.log('Concurrency | Total Reqs | Throughput (r/s) | P50 (ms) | P95 (ms) | P99 (ms) | Errors (%)');
    console.log('--------------------------------------------------------------------------------');

    for (const c of concurrencyTiers) {
      const totalRequests = c * 10; // e.g. 100, 250, 500, 1000 requests
      const metrics = await runConcurrentWorkers({
        workerCount: c,
        totalRequests,
        taskFn: suite.task,
      });

      console.log(
        `${String(metrics.concurrency).padEnd(11)} | ` +
        `${String(metrics.totalRequests).padEnd(10)} | ` +
        `${String(metrics.throughputReqSec).padEnd(16)} | ` +
        `${String(metrics.p50).padEnd(8)} | ` +
        `${String(metrics.p95).padEnd(8)} | ` +
        `${String(metrics.p99).padEnd(8)} | ` +
        `${String(metrics.errorRate + '%').padEnd(10)}`
      );

      resultsTable.push({
        suite: suite.name,
        ...metrics,
      });
    }
  }

  io.close();
  await new Promise((resolve) => server.close(resolve));
  await closeTestDatabase();

  console.log('\n================================================================================');
  console.log(' API LOAD TEST SUITE COMPLETED SUCCESSFULLY                                     ');
  console.log('================================================================================\n');

  return resultsTable;
}

if (process.argv[1] && process.argv[1].endsWith('apiLoad.bench.js')) {
  runApiLoadTests().then(() => process.exit(0)).catch((err) => {
    console.error('API Load test failed:', err);
    process.exit(1);
  });
}
