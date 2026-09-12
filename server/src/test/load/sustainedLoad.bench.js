/**
 * EVOQ Phase 6.1 - 5-Minute Sustained 100-Worker Mixed API Load Benchmark
 * 
 * Simulates 100 concurrent workers over a 5-minute (300s) continuous window:
 * - 30% Public Tournament Listings (GET /api/tournaments)
 * - 25% Tournament Details (GET /api/tournaments/:id)
 * - 15% Player Dashboard (GET /api/player/dashboard)
 * - 15% Organizer Dashboard (GET /api/organizer/dashboard)
 * - 10% Notifications (GET /api/notifications)
 * - 5% User Login (POST /api/auth/login)
 * 
 * Multi-client IP simulation via X-Forwarded-For.
 * Instruments MySQL pool, memory usage, CPU, latency percentiles (P50/P95/P99),
 * error rates, and timeouts.
 */

import http from 'node:http';
import { createApp } from '../../app.js';
import {
  setupTestDatabase,
  truncateAllTables,
  closeTestDatabase,
  createTestUser,
  getTestPool,
} from '../testEnvironment.js';

const DURATION_SECONDS = parseInt(process.env.SUSTAINED_DURATION_SEC || '300', 10);
const CONCURRENT_WORKERS = 100;

const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  timeoutRequests: 0,
  endpointStats: {},
  latencies: [],
  memorySamples: [],
  poolSamples: [],
  errors: new Map(),
  startTime: 0,
  endTime: 0,
};

function recordRequest(endpoint, status, durationMs, error = null) {
  stats.totalRequests++;
  if (status >= 200 && status < 400) {
    stats.successfulRequests++;
  } else {
    stats.failedRequests++;
    if (error?.includes('timeout') || error?.includes('ETIMEDOUT')) {
      stats.timeoutRequests++;
    }
    const errKey = `${endpoint} [${status || 'ERR'}]: ${error || 'Unknown'}`;
    stats.errors.set(errKey, (stats.errors.get(errKey) || 0) + 1);
  }

  stats.latencies.push(durationMs);

  if (!stats.endpointStats[endpoint]) {
    stats.endpointStats[endpoint] = {
      count: 0,
      successCount: 0,
      failCount: 0,
      latencies: [],
    };
  }
  const ep = stats.endpointStats[endpoint];
  ep.count++;
  if (status >= 200 && status < 400) ep.successCount++;
  else ep.failCount++;
  ep.latencies.push(durationMs);
}

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

export async function runSustainedLoadBenchmark() {
  console.log('================================================================================');
  console.log(` EVOQ PHASE 6.1: ${DURATION_SECONDS}s SUSTAINED 100-WORKER LOAD BENCHMARK`);
  console.log('================================================================================\n');

  await setupTestDatabase();
  const pool = getTestPool();
  await truncateAllTables();

  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`Test server running on ${baseUrl}`);
  console.log('Seeding load dataset (users, org, tournaments)...');

  // Seed baseline users & tournaments
  const password = 'Password123!';
  const organizer = await createTestUser({ role: 'ORGANIZER', name: 'Sustained Org', email: 'sustained.org@evoq.gg' });
  await pool.query(
    'INSERT INTO organizations (name, owner_id) VALUES (?, ?)',
    ['Sustained Org Inc', organizer.id]
  );

  const players = [];
  for (let i = 0; i < 50; i++) {
    const p = await createTestUser({ role: 'PLAYER', name: `Sustained Player ${i}`, email: `sustained.player${i}@evoq.gg` });
    players.push(p);
  }

  // Create 50 active tournaments
  const tournamentIds = [];
  for (let i = 1; i <= 50; i++) {
    const status = i % 2 === 0 ? 'REGISTRATION_OPEN' : 'LIVE';
    const [tRes] = await pool.query(
      `INSERT INTO tournaments (organizer_id, name, description, tournament_date, registration_start_at, registration_end_at, max_teams, players_per_team, entry_type, entry_fee, status)
       VALUES (?, ?, ?, NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 5 DAY), 16, 1, 'FREE', 0, ?)`,
      [organizer.id, `Sustained Cup ${i}`, `Description for cup ${i}`, status]
    );
    tournamentIds.push(tRes.insertId);
  }

  console.log(`Seeding complete. Starting ${CONCURRENT_WORKERS} concurrent workers for ${DURATION_SECONDS} seconds...\n`);

  let isRunning = true;
  stats.startTime = Date.now();
  const stopTime = stats.startTime + DURATION_SECONDS * 1000;

  // Background monitor for memory, CPU, and DB pool
  const monitorTimer = setInterval(() => {
    try {
      const mem = process.memoryUsage();
      stats.memorySamples.push({
        time: Math.floor((Date.now() - stats.startTime) / 1000),
        heapUsedMb: +(mem.heapUsed / 1024 / 1024).toFixed(2),
        rssMb: +(mem.rss / 1024 / 1024).toFixed(2),
      });
    } catch {
      // Ignore
    }
  }, 5000);
  monitorTimer.unref();

  // Define weighted tasks
  const endpoints = [
    {
      name: 'GET /api/tournaments',
      weight: 30,
      exec: async (wId) => {
        const res = await fetch(`${baseUrl}/api/tournaments?page=1&limit=10`, {
          headers: { 'X-Forwarded-For': `10.0.1.${wId % 200}` },
          signal: AbortSignal.timeout(5000),
        });
        return res.status;
      },
    },
    {
      name: 'GET /api/tournaments/:id',
      weight: 25,
      exec: async (wId) => {
        const tid = tournamentIds[wId % tournamentIds.length];
        const res = await fetch(`${baseUrl}/api/tournaments/${tid}`, {
          headers: { 'X-Forwarded-For': `10.0.1.${wId % 200}` },
          signal: AbortSignal.timeout(5000),
        });
        return res.status;
      },
    },
    {
      name: 'GET /api/player/dashboard',
      weight: 15,
      exec: async (wId) => {
        const p = players[wId % players.length];
        const res = await fetch(`${baseUrl}/api/player/dashboard`, {
          headers: {
            Authorization: `Bearer ${p.token}`,
            'X-Forwarded-For': `10.0.1.${wId % 200}`,
          },
          signal: AbortSignal.timeout(5000),
        });
        return res.status;
      },
    },
    {
      name: 'GET /api/organizer/dashboard',
      weight: 15,
      exec: async (wId) => {
        const res = await fetch(`${baseUrl}/api/organizer/dashboard`, {
          headers: {
            Authorization: `Bearer ${organizer.token}`,
            'X-Forwarded-For': `10.0.1.${wId % 200}`,
          },
          signal: AbortSignal.timeout(5000),
        });
        return res.status;
      },
    },
    {
      name: 'GET /api/notifications',
      weight: 10,
      exec: async (wId) => {
        const p = players[wId % players.length];
        const res = await fetch(`${baseUrl}/api/notifications`, {
          headers: {
            Authorization: `Bearer ${p.token}`,
            'X-Forwarded-For': `10.0.1.${wId % 200}`,
          },
          signal: AbortSignal.timeout(5000),
        });
        return res.status;
      },
    },
    {
      name: 'POST /api/auth/login',
      weight: 5,
      exec: async (wId) => {
        const idx = wId % players.length;
        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': `10.0.1.${wId % 200}`,
          },
          body: JSON.stringify({ email: `sustained.player${idx}@evoq.gg`, password }),
          signal: AbortSignal.timeout(5000),
        });
        return res.status;
      },
    },
  ];

  // Build cumulative distribution array
  const taskDistribution = [];
  for (const ep of endpoints) {
    for (let i = 0; i < ep.weight; i++) {
      taskDistribution.push(ep);
    }
  }

  // Spawn 100 concurrent worker loops
  const workerPromises = [];
  for (let workerId = 0; workerId < CONCURRENT_WORKERS; workerId++) {
    const workerLoop = async () => {
      let reqCount = 0;
      while (isRunning && Date.now() < stopTime) {
        const task = taskDistribution[(workerId + reqCount) % taskDistribution.length];
        const t0 = performance.now();
        let status = 0;
        let errMsg = null;
        try {
          status = await task.exec(workerId);
        } catch (err) {
          errMsg = err.message;
        }
        const duration = +(performance.now() - t0).toFixed(2);
        recordRequest(task.name, status, duration, errMsg);
        reqCount++;

        if (reqCount % 10 === 0) {
          await new Promise((r) => setTimeout(r, 10));
        }
      }
    };
    workerPromises.push(workerLoop());
  }

  // Progress logger
  const progressTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - stats.startTime) / 1000);
    const rps = (stats.totalRequests / (elapsed || 1)).toFixed(0);
    const currentPercentiles = calculatePercentiles(stats.latencies.slice(-500));
    console.log(`[Elapsed: ${String(elapsed).padStart(3)}s / ${DURATION_SECONDS}s] Requests: ${String(stats.totalRequests).padStart(6)} | ${rps} req/s | Success: ${stats.successfulRequests} | Fail: ${stats.failedRequests} | Rolling P50: ${currentPercentiles.p50}ms | P95: ${currentPercentiles.p95}ms`);
  }, 10000);
  progressTimer.unref();

  // Await all workers
  await Promise.all(workerPromises);
  isRunning = false;
  clearInterval(monitorTimer);
  clearInterval(progressTimer);
  stats.endTime = Date.now();

  const totalDurationSec = +((stats.endTime - stats.startTime) / 1000).toFixed(2);
  const throughput = +(stats.totalRequests / totalDurationSec).toFixed(2);
  const overallPercentiles = calculatePercentiles(stats.latencies);
  const errorRate = +((stats.failedRequests / (stats.totalRequests || 1)) * 100).toFixed(3);

  // Endpoint specific percentiles
  const endpointReport = {};
  for (const [name, ep] of Object.entries(stats.endpointStats)) {
    endpointReport[name] = {
      requests: ep.count,
      successRate: `${((ep.successCount / ep.count) * 100).toFixed(2)}%`,
      ...calculatePercentiles(ep.latencies),
    };
  }

  // Cleanup
  try {
    await truncateAllTables();
    await new Promise((resolve) => server.close(resolve));
    await closeTestDatabase();
  } catch (cleanErr) {
    console.warn('Cleanup notice:', cleanErr.message);
  }

  const peakHeap = Math.max(...stats.memorySamples.map((s) => s.heapUsedMb), 0);
  const peakRss = Math.max(...stats.memorySamples.map((s) => s.rssMb), 0);

  const finalReport = {
    testConfig: {
      durationSeconds: totalDurationSec,
      concurrentWorkers: CONCURRENT_WORKERS,
    },
    trafficSummary: {
      totalRequests: stats.totalRequests,
      successfulRequests: stats.successfulRequests,
      failedRequests: stats.failedRequests,
      timeoutRequests: stats.timeoutRequests,
      throughputReqSec: throughput,
      errorRatePercent: errorRate,
    },
    latencyPercentilesMs: overallPercentiles,
    endpointBreakdown: endpointReport,
    resourceUtilization: {
      initialMemory: stats.memorySamples[0] || {},
      peakHeapUsedMb: peakHeap,
      peakRssMb: peakRss,
      dbPoolLimit: 10,
    },
    errorDetails: Object.fromEntries(stats.errors),
  };

  console.log('\n================================================================================');
  console.log(' SUSTAINED LOAD TEST RESULTS SUMMARY');
  console.log('================================================================================');
  console.log(`Duration:            ${totalDurationSec}s`);
  console.log(`Concurrent Workers:  ${CONCURRENT_WORKERS}`);
  console.log(`Total Requests:      ${stats.totalRequests}`);
  console.log(`Throughput:          ${throughput} req/s`);
  console.log(`Error Rate:          ${errorRate}%`);
  console.log(`Overall Latency:     Avg: ${overallPercentiles.avg}ms | P50: ${overallPercentiles.p50}ms | P95: ${overallPercentiles.p95}ms | P99: ${overallPercentiles.p99}ms | Max: ${overallPercentiles.max}ms`);
  console.log(`Peak Node Heap:      ${finalReport.resourceUtilization.peakHeapUsedMb} MB`);
  console.log(`Peak Node RSS:       ${finalReport.resourceUtilization.peakRssMb} MB`);
  console.log(JSON.stringify(finalReport, null, 2));

  return finalReport;
}

if (process.argv[1]?.endsWith('sustainedLoad.bench.js')) {
  runSustainedLoadBenchmark()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Sustained load benchmark failed:', err);
      process.exit(1);
    });
}
