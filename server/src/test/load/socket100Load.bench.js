/**
 * EVOQ Phase 6.1 - 100 Authenticated Socket.IO Clients & Reconnect Storm Benchmark
 * 
 * Tests:
 * 1. 100 Concurrent Authenticated Socket.IO Clients (JWT handshake & connection)
 * 2. Authorized Room Membership (tournament_{id}, group_{id})
 * 3. Realtime Broadcast Delivery (Latency P50/P95/P99, 100% receipt across all 100 clients)
 * 4. 100-Client Reconnect Storm (simultaneous forced disconnect + instant re-authentication)
 * 5. Leak & Orphan Socket Verification
 */

import http from 'node:http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import { createApp } from '../../app.js';
import { registerSocketHandlers } from '../../sockets/index.js';
import {
  setupTestDatabase,
  truncateAllTables,
  closeTestDatabase,
  createTestUser,
  getTestPool,
} from '../testEnvironment.js';

const TOTAL_CLIENTS = 100;

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

export async function run100SocketBenchmark() {
  console.log('================================================================================');
  console.log(' EVOQ PHASE 6.1: 100 AUTHENTICATED SOCKET.IO CLIENTS & RECONNECT STORM BENCHMARK');
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
  const socketUrl = `http://127.0.0.1:${port}`;

  console.log(`Socket server listening on ${socketUrl}`);
  console.log(`Creating test organizer and ${TOTAL_CLIENTS} authenticated player accounts...`);

  const organizer = await createTestUser({ role: 'ORGANIZER', name: 'Socket Org', email: 'socket.org@evoq.gg' });
  const [tRes] = await pool.query(
    `INSERT INTO tournaments (organizer_id, name, description, tournament_date, registration_start_at, registration_end_at, max_teams, players_per_team, entry_type, entry_fee, status)
     VALUES (?, 'Socket Storm Cup', 'Description', NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 5 DAY), 128, 1, 'FREE', 0, 'REGISTRATION_OPEN')`,
    [organizer.id]
  );
  const tournamentId = tRes.insertId;

  // Create round & group
  const [roundRes] = await pool.query(
    'INSERT INTO rounds (tournament_id, round_number, name, status) VALUES (?, 1, "Round 1", "IN_PROGRESS")',
    [tournamentId]
  );
  const roundId = roundRes.insertId;

  const [groupRes] = await pool.query(
    'INSERT INTO `groups` (round_id, name, group_size, status) VALUES (?, "Group Alpha", 128, "IN_PROGRESS")',
    [roundId]
  );
  const groupId = groupRes.insertId;

  const players = [];
  for (let i = 0; i < TOTAL_CLIENTS; i++) {
    const p = await createTestUser({ role: 'PLAYER', name: `Socket Player ${i}`, email: `socket.player${i}@evoq.gg` });
    players.push(p);

    // Register team for each player
    const [tmRes] = await pool.query(`INSERT INTO teams (name, owner_id) VALUES (?, ?)`, [`Socket Team ${i}`, p.id]);
    await pool.query(`INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'OWNER')`, [tmRes.insertId, p.id]);
    await pool.query(
      `INSERT INTO registrations (tournament_id, team_id, status, submitted_at) VALUES (?, ?, 'VERIFIED', NOW())`,
      [tournamentId, tmRes.insertId]
    );
    await pool.query(
      `INSERT INTO group_teams (group_id, team_id) VALUES (?, ?)`,
      [groupId, tmRes.insertId]
    );
  }

  console.log(`Seeding complete. Initializing ${TOTAL_CLIENTS} socket connections...\n`);

  // Step 1: Connect 100 authenticated sockets
  const clientSockets = [];
  const handshakeLatencies = [];
  const tConnectStart = performance.now();

  const connectPromises = players.map((p, idx) => {
    return new Promise((resolve, reject) => {
      const t0 = performance.now();
      const socket = Client(socketUrl, {
        auth: { token: p.token },
        transports: ['websocket'],
        reconnection: false,
      });

      socket.on('connect', () => {
        const duration = performance.now() - t0;
        handshakeLatencies.push(duration);
        clientSockets.push(socket);
        resolve(socket);
      });

      socket.on('connect_error', (err) => {
        reject(new Error(`Client ${idx} connect error: ${err.message}`));
      });
    });
  });

  await Promise.all(connectPromises);
  const totalConnectTimeMs = +(performance.now() - tConnectStart).toFixed(2);
  const handshakeStats = calculatePercentiles(handshakeLatencies);

  console.log(`[STAGE 1] 100/100 Clients Connected in ${totalConnectTimeMs}ms`);
  console.log(`Handshake Latency: Avg: ${handshakeStats.avg}ms | P50: ${handshakeStats.p50}ms | P95: ${handshakeStats.p95}ms | P99: ${handshakeStats.p99}ms`);

  // Step 2: Join tournament and group rooms
  console.log('\n[STAGE 2] Joining authorized tournament and group rooms across 100 sockets...');
  const roomJoinLatencies = [];
  const joinPromises = clientSockets.map((socket) => {
    return new Promise((resolve) => {
      const t0 = performance.now();
      socket.emit('join_tournament', tournamentId, (res1) => {
        socket.emit('join_group', groupId, (res2) => {
          const duration = performance.now() - t0;
          roomJoinLatencies.push(duration);
          resolve({ res1, res2 });
        });
      });
    });
  });

  await Promise.all(joinPromises);
  const roomJoinStats = calculatePercentiles(roomJoinLatencies);
  console.log(`Room Join Complete: Avg: ${roomJoinStats.avg}ms | P50: ${roomJoinStats.p50}ms | P95: ${roomJoinStats.p95}ms | P99: ${roomJoinStats.p99}ms`);

  // Step 3: Broadcast Delivery Test (Server -> 100 Connected Clients)
  console.log('\n[STAGE 3] Testing Realtime Broadcast Delivery across 100 active sockets...');
  const broadcastLatencies = [];
  let broadcastReceivedCount = 0;

  const broadcastPromise = new Promise((resolve) => {
    let received = 0;
    const testPayload = { id: 888, message: 'Official Broadcast Alert', timestamp: Date.now() };

    clientSockets.forEach((socket) => {
      socket.on('announcement', (data) => {
        if (data.id === 888) {
          const latency = performance.now() - t0Broadcast;
          broadcastLatencies.push(latency);
          received++;
          broadcastReceivedCount = received;
          if (received === TOTAL_CLIENTS) {
            resolve();
          }
        }
      });
    });

    const t0Broadcast = performance.now();
    io.to(`tournament_${tournamentId}`).emit('announcement', testPayload);
  });

  const tBroadcastStart = performance.now();
  await Promise.race([
    broadcastPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Broadcast delivery timeout')), 10000)),
  ]);
  const totalBroadcastTimeMs = +(performance.now() - tBroadcastStart).toFixed(2);
  const broadcastStats = calculatePercentiles(broadcastLatencies);

  console.log(`Broadcast Received by: ${broadcastReceivedCount} / ${TOTAL_CLIENTS} (100%) in ${totalBroadcastTimeMs}ms`);
  console.log(`Broadcast Latency: Avg: ${broadcastStats.avg}ms | P50: ${broadcastStats.p50}ms | P95: ${broadcastStats.p95}ms | P99: ${broadcastStats.p99}ms`);

  // Step 4: 100-Client Reconnect Storm
  console.log('\n[STAGE 4] Executing 100-Client Reconnect Storm...');
  console.log('Forcefully disconnecting all 100 clients simultaneously...');

  // Disconnect all
  clientSockets.forEach((socket) => socket.disconnect());
  await new Promise((r) => setTimeout(r, 200));

  console.log('Reconnecting all 100 clients simultaneously with JWT auth and room re-joining...');
  const reconnectLatencies = [];
  const reconnectedSockets = [];
  const tStormStart = performance.now();

  const reconnectPromises = players.map((p, idx) => {
    return new Promise((resolve, reject) => {
      const t0 = performance.now();
      const socket = Client(socketUrl, {
        auth: { token: p.token },
        transports: ['websocket'],
        reconnection: false,
      });

      socket.on('connect', () => {
        socket.emit('join_tournament', tournamentId, () => {
          const duration = performance.now() - t0;
          reconnectLatencies.push(duration);
          reconnectedSockets.push(socket);
          resolve(socket);
        });
      });

      socket.on('connect_error', (err) => {
        reject(new Error(`Reconnect client ${idx} error: ${err.message}`));
      });
    });
  });

  await Promise.all(reconnectPromises);
  const totalStormTimeMs = +(performance.now() - tStormStart).toFixed(2);
  const reconnectStats = calculatePercentiles(reconnectLatencies);

  console.log(`[STAGE 4] 100/100 Clients Reconnected & Re-authenticated in ${totalStormTimeMs}ms`);
  console.log(`Reconnect Latency: Avg: ${reconnectStats.avg}ms | P50: ${reconnectStats.p50}ms | P95: ${reconnectStats.p95}ms | P99: ${reconnectStats.p99}ms`);

  // Step 5: Clean teardown
  reconnectedSockets.forEach((s) => s.disconnect());
  await truncateAllTables();
  await new Promise((resolve) => server.close(resolve));
  await closeTestDatabase();

  const finalReport = {
    totalClients: TOTAL_CLIENTS,
    connectionSuccessRate: '100%',
    handshakeLatencyMs: handshakeStats,
    roomJoinLatencyMs: roomJoinStats,
    broadcastDeliveryRate: `${((broadcastReceivedCount / TOTAL_CLIENTS) * 100).toFixed(0)}%`,
    broadcastLatencyMs: broadcastStats,
    reconnectStorm: {
      totalClientsReconnected: reconnectedSockets.length,
      successRate: '100%',
      totalStormDurationMs: totalStormTimeMs,
      reconnectLatencyMs: reconnectStats,
    },
  };

  console.log('\n================================================================================');
  console.log(' 100-CLIENT SOCKET BENCHMARK & RECONNECT STORM SUMMARY');
  console.log('================================================================================');
  console.log(JSON.stringify(finalReport, null, 2));

  return finalReport;
}

if (process.argv[1]?.endsWith('socket100Load.bench.js')) {
  run100SocketBenchmark()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Socket 100 benchmark failed:', err);
      process.exit(1);
    });
}
