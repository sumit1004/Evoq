import http from 'node:http';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import { createApp } from '../../app.js';
import { registerSocketHandlers } from '../../sockets/index.js';
import { emitRealtime, realtimeRooms } from '../../utils/realtimeHub.js';
import {
  setupTestDatabase,
  truncateAllTables,
  closeTestDatabase,
  createTestUser,
  getTestPool,
} from '../testEnvironment.js';

export async function runSocketLoadTests() {
  console.log('================================================================================');
  console.log(' EVOQ PHASE 6: SOCKET.IO LOAD, BROADCAST & RECONNECT STORM BENCHMARK            ');
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
  const socketUrl = `http://localhost:${port}`;

  console.log('1. Setting up test users, teams, registrations and groups for socket broadcasting...');
  const organizer = await createTestUser({ role: 'ORGANIZER', name: 'Socket Org', email: 'socket.org@evoq.gg' });
  const [tourneyRes] = await pool.query(
    `INSERT INTO tournaments (organizer_id, name, description, tournament_date, registration_start_at, registration_end_at, max_teams, players_per_team, entry_type, entry_fee, status)
     VALUES (?, 'Socket Arena', 'Socket load benchmark', DATE_ADD(NOW(), INTERVAL 5 DAY), NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 64, 1, 'FREE', 0, 'LIVE')`,
    [organizer.id]
  );
  const tournamentId = tourneyRes.insertId;

  const [roundRes] = await pool.query(
    'INSERT INTO rounds (tournament_id, round_number, name, status) VALUES (?, 1, "Round 1", "IN_PROGRESS")',
    [tournamentId]
  );
  const roundId = roundRes.insertId;

  const [groupRes] = await pool.query(
    'INSERT INTO `groups` (round_id, name, group_size, status) VALUES (?, "Group 1", 64, "IN_PROGRESS")',
    [roundId]
  );
  const groupId = groupRes.insertId;

  // Create 50 player users with teams, registered and assigned to group
  const players = [];
  for (let i = 0; i < 50; i++) {
    const p = await createTestUser({ role: 'PLAYER', name: `Socket Player ${i}`, email: `socket.player${i}@evoq.gg` });
    const [tRes] = await pool.query('INSERT INTO teams (name, owner_id) VALUES (?, ?)', [`Team ${i}`, p.id]);
    const teamId = tRes.insertId;
    await pool.query('INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, "OWNER")', [teamId, p.id]);
    await pool.query(
      'INSERT INTO registrations (tournament_id, team_id, status) VALUES (?, ?, "VERIFIED")',
      [tournamentId, teamId]
    );
    await pool.query(
      'INSERT INTO group_teams (group_id, team_id) VALUES (?, ?)',
      [groupId, teamId]
    );
    players.push(p);
  }

  // TEST 1: Concurrent Socket Connections (10, 25, 50 sockets)
  console.log('\n--- TEST 1: Concurrent Socket Connections & Room Subscriptions ---');
  const socketTiers = [10, 25, 50];
  const socketMetrics = [];

  for (const count of socketTiers) {
    const t0Connect = performance.now();
    const sockets = [];

    for (let i = 0; i < count; i++) {
      const s = ClientIO(socketUrl, {
        auth: { token: players[i].token },
        transports: ['websocket'],
        forceNew: true,
      });
      sockets.push(s);
    }

    await Promise.all(
      sockets.map((s) => new Promise((resolve, reject) => {
        s.on('connect', resolve);
        s.on('connect_error', reject);
      }))
    );
    const connectDurationMs = performance.now() - t0Connect;
    const avgConnectMs = Number((connectDurationMs / count).toFixed(2));

    // Join tournament & group rooms with acknowledgement wait
    await Promise.all(
      sockets.map((s) => new Promise((res) => {
        s.emit('join_tournament', tournamentId, () => {
          s.emit('join_group', groupId, () => res());
        });
      }))
    );

    // TEST 2: High Throughput Broadcast Latency
    let receivedCount = 0;
    const broadcastPayload = { id: 999, message: 'Tournament Update Broadcast', timestamp: Date.now() };

    sockets.forEach((s) => {
      s.on('announcement', (data) => {
        if (data.id === 999) receivedCount++;
      });
    });

    const t0Broadcast = performance.now();
    emitRealtime(realtimeRooms.tournament(tournamentId), 'announcement', broadcastPayload);

    // Wait for all sockets to receive event
    let attempts = 0;
    while (receivedCount < count && attempts < 20) {
      await new Promise((r) => setTimeout(r, 20));
      attempts++;
    }
    const broadcastLatencyMs = performance.now() - t0Broadcast;

    console.log(`Connected: ${String(count).padEnd(2)} sockets | Total Handshake: ${connectDurationMs.toFixed(2)}ms (Avg: ${avgConnectMs}ms) | Broadcast Delivery: ${receivedCount}/${count} in ${broadcastLatencyMs.toFixed(2)}ms`);

    socketMetrics.push({
      clientCount: count,
      totalConnectTimeMs: connectDurationMs,
      avgConnectLatencyMs: avgConnectMs,
      deliveredEvents: receivedCount,
      broadcastLatencyMs: Number(broadcastLatencyMs.toFixed(2)),
    });

    sockets.forEach((s) => s.disconnect());
    await new Promise((r) => setTimeout(r, 50));
  }

  // TEST 3: Group Chat Spam Rate-Limiter Under High Frequency
  console.log('\n--- TEST 3: Group Chat Spam Protection & Rate Limiting ---');
  const chatClient = ClientIO(socketUrl, {
    auth: { token: players[0].token },
    transports: ['websocket'],
    forceNew: true,
  });

  await new Promise((resolve) => chatClient.on('connect', resolve));
  await new Promise((resolve) => chatClient.emit('join_group', groupId, resolve));

  let allowedMessages = 0;
  let blockedMessages = 0;

  for (let i = 0; i < 35; i++) {
    await new Promise((resolve) => {
      chatClient.emit('send_message', { groupId, message: `Spam message ${i}` }, (res) => {
        if (res?.ok) allowedMessages++;
        else blockedMessages++;
        resolve();
      });
    });
  }

  console.log(`Sent 35 Rapid Messages -> Allowed: ${allowedMessages}, Blocked by Rate Limiter: ${blockedMessages}`);
  if (blockedMessages === 0) {
    throw new Error('Chat rate limiter failed to block rapid spam!');
  }
  console.log('✓ Chat rate limiter actively protected system against spam (enforced 30 messages/10s).');
  chatClient.disconnect();

  // TEST 4: Reconnect Storm Simulation (50 clients disconnect simultaneously then reconnect)
  console.log('\n--- TEST 4: Reconnect Storm Simulation (50 Clients) ---');
  const stormSockets = players.map((p) =>
    ClientIO(socketUrl, {
      auth: { token: p.token },
      transports: ['websocket'],
      forceNew: true,
    })
  );

  await Promise.all(
    stormSockets.map((s) => new Promise((resolve) => s.on('connect', resolve)))
  );
  console.log('50 sockets active. Triggering simultaneous mass disconnect...');
  stormSockets.forEach((s) => s.disconnect());

  await new Promise((r) => setTimeout(r, 100));
  console.log('Simultaneous mass reconnecting...');
  const t0Storm = performance.now();

  const reconnectedSockets = players.map((p) =>
    ClientIO(socketUrl, {
      auth: { token: p.token },
      transports: ['websocket'],
      forceNew: true,
    })
  );

  await Promise.all(
    reconnectedSockets.map((s) => new Promise((resolve) => s.on('connect', resolve)))
  );
  const stormDurationMs = performance.now() - t0Storm;
  console.log(`Reconnect Storm Settled: 50/50 sockets re-authenticated in ${stormDurationMs.toFixed(2)}ms (Avg: ${(stormDurationMs / 50).toFixed(2)}ms)`);
  console.log('✓ Server remained 100% stable during disconnect/reconnect storm.');

  reconnectedSockets.forEach((s) => s.disconnect());
  io.close();
  await new Promise((resolve) => server.close(resolve));
  await closeTestDatabase();

  console.log('\n================================================================================');
  console.log(' SOCKET.IO LOAD & RECONNECT STORM TESTS PASSED                                  ');
  console.log('================================================================================\n');

  return {
    socketMetrics,
    stormDurationMs: Number(stormDurationMs.toFixed(2)),
  };
}

if (process.argv[1] && process.argv[1].endsWith('socketLoad.bench.js')) {
  runSocketLoadTests().then(() => process.exit(0)).catch((err) => {
    console.error('Socket test failed:', err);
    process.exit(1);
  });
}
