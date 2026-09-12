import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
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

export async function measureBaseline() {
  console.log('====================================================');
  console.log(' EVOQ PHASE 6: BASELINE PERFORMANCE MEASUREMENTS   ');
  console.log('====================================================\n');

  // 1. Frontend Bundle Measurements
  console.log('--- 1. Frontend Bundle Baseline ---');
  const distDir = path.resolve(process.cwd(), '../client/dist/assets');
  let jsBundleStats = { file: 'none', rawBytes: 0, gzipBytes: 0, brotliBytes: 0 };
  let cssBundleStats = { file: 'none', rawBytes: 0, gzipBytes: 0, brotliBytes: 0 };

  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir);
    for (const file of files) {
      const filePath = path.join(distDir, file);
      const content = fs.readFileSync(filePath);
      const rawBytes = content.length;
      const gzipBytes = zlib.gzipSync(content).length;
      const brotliBytes = zlib.brotliCompressSync(content).length;

      if (file.endsWith('.js') && !file.includes('vendor')) {
        jsBundleStats = { file, rawBytes, gzipBytes, brotliBytes };
      } else if (file.endsWith('.css')) {
        cssBundleStats = { file, rawBytes, gzipBytes, brotliBytes };
      }
    }
  }

  console.log(`JS Bundle:  ${jsBundleStats.file} | ${(jsBundleStats.rawBytes / 1024).toFixed(2)} kB (gzip: ${(jsBundleStats.gzipBytes / 1024).toFixed(2)} kB, brotli: ${(jsBundleStats.brotliBytes / 1024).toFixed(2)} kB)`);
  console.log(`CSS Bundle: ${cssBundleStats.file} | ${(cssBundleStats.rawBytes / 1024).toFixed(2)} kB (gzip: ${(cssBundleStats.gzipBytes / 1024).toFixed(2)} kB, brotli: ${(cssBundleStats.brotliBytes / 1024).toFixed(2)} kB)\n`);

  // 2. Database Connection Pool & Ping
  console.log('--- 2. Database Pool Configuration ---');
  await setupTestDatabase();
  const pool = getTestPool();
  console.log(`Host: ${config.db.host}:${config.db.port}`);
  console.log(`Database: ${config.db.database}`);
  console.log(`Connection Limit: ${config.db.connectionLimit}`);
  console.log(`Connect Timeout: ${config.db.connectTimeout}ms`);

  const t0Db = performance.now();
  const [dbPing] = await pool.query('SELECT 1 as ok, NOW() as now_time');
  const dbPingMs = performance.now() - t0Db;
  console.log(`MySQL Ping Latency: ${dbPingMs.toFixed(2)}ms (ok: ${dbPing[0].ok})\n`);

  // 3. Backend Startup & Boot Latency
  console.log('--- 3. Backend Cold / Warm Startup Measurement ---');
  const t0Boot = performance.now();
  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  });
  registerSocketHandlers(io);

  await new Promise((resolve) => server.listen(0, resolve));
  const bootDurationMs = performance.now() - t0Boot;
  const port = server.address().port;
  console.log(`Server Boot & Socket.IO Attachment: ${bootDurationMs.toFixed(2)}ms (Port: ${port})\n`);

  // Truncate and seed test data
  await truncateAllTables();
  const player = await createTestUser({ role: 'PLAYER', name: 'Player Baseline', email: 'baseline.player@evoq.gg' });
  const organizer = await createTestUser({ role: 'ORGANIZER', name: 'Organizer Baseline', email: 'baseline.organizer@evoq.gg' });

  // Create baseline tournament
  const [tourneyResult] = await pool.query(
    `INSERT INTO tournaments (organizer_id, name, description, tournament_date, registration_start_at, registration_end_at, max_teams, players_per_team, entry_type, entry_fee, status)
     VALUES (?, 'Baseline Cup', 'Baseline Performance Test Cup', DATE_ADD(NOW(), INTERVAL 7 DAY), NOW(), DATE_ADD(NOW(), INTERVAL 5 DAY), 16, 4, 'FREE', 0, 'LIVE')`,
    [organizer.id]
  );
  const tournamentId = tourneyResult.insertId;

  // 4. API Baseline Response Latencies
  console.log('--- 4. Major Route API Baseline Latencies (1 Request) ---');
  const baseUrl = `http://localhost:${port}`;

  async function timeRequest(name, method, urlPath, headers = {}, body = null) {
    const t0 = performance.now();
    const res = await fetch(`${baseUrl}${urlPath}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const durationMs = performance.now() - t0;
    const json = await res.json().catch(() => ({}));
    console.log(`  ${method.padEnd(4)} ${urlPath.padEnd(35)} -> ${res.status} in ${durationMs.toFixed(2)}ms`);
    return { name, method, urlPath, status: res.status, durationMs, json };
  }

  await timeRequest('Health Check', 'GET', '/health');
  await timeRequest('Tournaments List (Public)', 'GET', '/api/tournaments');
  const loginRes = await timeRequest('Login (Player)', 'POST', '/api/auth/login', {}, { email: 'baseline.player@evoq.gg', password: 'Password123!' });
  const playerToken = loginRes.json.token;

  await timeRequest('Player Dashboard', 'GET', '/api/player/dashboard', { Authorization: `Bearer ${playerToken}` });
  await timeRequest('Player Profile', 'GET', '/api/player/profile', { Authorization: `Bearer ${playerToken}` });
  await timeRequest('Tournaments Discovery (Auth)', 'GET', '/api/tournaments', { Authorization: `Bearer ${playerToken}` });
  await timeRequest('Tournament Details (Live)', 'GET', `/api/tournaments/${tournamentId}`, { Authorization: `Bearer ${playerToken}` });

  const orgLoginRes = await timeRequest('Login (Organizer)', 'POST', '/api/auth/login', {}, { email: 'baseline.organizer@evoq.gg', password: 'Password123!' });
  const orgToken = orgLoginRes.json.token;
  await timeRequest('Organizer Dashboard', 'GET', '/api/organizer/dashboard', { Authorization: `Bearer ${orgToken}` });
  await timeRequest('Organizer Tournaments', 'GET', '/api/tournaments?scope=mine', { Authorization: `Bearer ${orgToken}` });
  await timeRequest('Competition Summary', 'GET', `/api/tournaments/${tournamentId}/competition`, { Authorization: `Bearer ${orgToken}` });
  await timeRequest('Tournament Leaderboards', 'GET', `/api/tournaments/${tournamentId}/leaderboards`, { Authorization: `Bearer ${playerToken}` });

  // 5. Socket.IO Handshake Latency
  console.log('\n--- 5. Socket.IO Handshake & Connection Latency ---');
  const t0Socket = performance.now();
  const clientSocket = ClientIO(`http://localhost:${port}`, {
    auth: { token: playerToken },
    transports: ['websocket'],
    forceNew: true,
  });

  await new Promise((resolve, reject) => {
    clientSocket.on('connect', resolve);
    clientSocket.on('connect_error', reject);
  });
  const socketHandshakeMs = performance.now() - t0Socket;
  console.log(`Socket.IO Handshake & Authentication: ${socketHandshakeMs.toFixed(2)}ms`);

  const t0Room = performance.now();
  clientSocket.emit('join_tournament', tournamentId);
  await new Promise((r) => setTimeout(r, 50));
  const roomJoinMs = performance.now() - t0Room;
  console.log(`Socket.IO Room Join (Tournament ${tournamentId}): ${roomJoinMs.toFixed(2)}ms`);

  clientSocket.disconnect();
  io.close();
  await new Promise((resolve) => server.close(resolve));
  await closeTestDatabase();
  console.log('\nBaseline measurements successfully captured.\n');

  return {
    jsBundleStats,
    cssBundleStats,
    bootDurationMs,
    dbPingMs,
    socketHandshakeMs,
  };
}

if (process.argv[1] && process.argv[1].endsWith('baseline.bench.js')) {
  measureBaseline().then(() => process.exit(0)).catch((err) => {
    console.error('Baseline measurement error:', err);
    process.exit(1);
  });
}
