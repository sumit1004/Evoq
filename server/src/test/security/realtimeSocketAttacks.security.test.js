import { describe, expect, it, beforeAll, beforeEach, afterAll } from 'vitest';
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
  createTestTournament,
  getTestPool,
} from '../testEnvironment.js';

describe('Red-Team Security: Realtime Socket.IO Attacks & Room Isolation', () => {
  let server;
  let io;
  let serverPort;
  let pool;

  beforeAll(async () => {
    pool = await setupTestDatabase();
    const app = createApp();
    server = http.createServer(app);
    io = new Server(server, {
      cors: { origin: '*' },
    });
    registerSocketHandlers(io);

    await new Promise((resolve) => {
      server.listen(0, () => {
        serverPort = server.address().port;
        resolve();
      });
    });
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    if (io) {
      io.disconnectSockets(true);
      await new Promise((resolve) => io.close(resolve));
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await closeTestDatabase();
  });

  it('rejects socket connection with missing or forged JWT auth payload', async () => {
    const socket = Client(`http://localhost:${serverPort}`, {
      auth: { token: 'invalid_malicious_token_string' },
      transports: ['websocket'],
      timeout: 3000,
    });

    const connectErrorPromise = new Promise((resolve) => {
      socket.on('connect_error', (err) => resolve(err.message));
    });

    const errorMsg = await connectErrorPromise;
    expect(errorMsg).toMatch(/invalid|expired|auth/i);
    socket.disconnect();
  });

  it('blocks unassigned player from joining private group rooms (Room Spoofing Attack)', async () => {
    const organizer = await createTestUser({ role: 'ORGANIZER' });
    const attacker = await createTestUser({ role: 'PLAYER' });
    const tournament = await createTestTournament(organizer.id, { status: 'LIVE' });

    // Create round and group
    const [rRes] = await pool.query(
      'INSERT INTO rounds (tournament_id, round_number, name, status, is_locked) VALUES (?, 1, "R1", "IN_PROGRESS", 1)',
      [tournament.id]
    );
    const roundId = rRes.insertId;

    const [gRes] = await pool.query(
      'INSERT INTO `groups` (round_id, name, group_size, status) VALUES (?, "Private Group Alpha", 12, "IN_PROGRESS")',
      [roundId]
    );
    const groupId = gRes.insertId;

    // Attacker connects to socket
    const socket = Client(`http://localhost:${serverPort}`, {
      auth: { token: attacker.token },
      transports: ['websocket'],
    });

    await new Promise((resolve) => socket.on('connect', resolve));

    // Attacker attempts to join unauthorized group
    const joinResponse = await new Promise((resolve) => {
      socket.emit('join_group', { groupId }, resolve);
    });

    expect(joinResponse.ok).toBe(false);
    expect(joinResponse.error).toMatch(/invalid|not found|forbidden|permission/i);

    socket.disconnect();
  });

  it('enforces socket-level chat message rate limits against spam bots', async () => {
    const organizer = await createTestUser({ role: 'ORGANIZER' });
    const tournament = await createTestTournament(organizer.id, { status: 'LIVE' });

    const [rRes] = await pool.query(
      'INSERT INTO rounds (tournament_id, round_number, name, status, is_locked) VALUES (?, 1, "R1", "IN_PROGRESS", 1)',
      [tournament.id]
    );
    const roundId = rRes.insertId;

    const [gRes] = await pool.query(
      'INSERT INTO `groups` (round_id, name, group_size, status) VALUES (?, "Open Group", 12, "IN_PROGRESS")',
      [roundId]
    );
    const groupId = gRes.insertId;

    const socket = Client(`http://localhost:${serverPort}`, {
      auth: { token: organizer.token },
      transports: ['websocket'],
    });

    await new Promise((resolve) => socket.on('connect', resolve));

    // Join group room
    await new Promise((resolve) => socket.emit('join_group', { groupId }, resolve));

    // Send 35 messages rapidly to trigger rate limiting (limit is 30 in 10s)
    let rateLimited = false;
    for (let i = 0; i < 35; i++) {
      const res = await new Promise((resolve) => {
        socket.emit('send_message', { groupId, message: `Spam message #${i}` }, resolve);
      });
      if (!res.ok && res.error && res.error.includes('slow down')) {
        rateLimited = true;
        break;
      }
    }

    expect(rateLimited).toBe(true);
    socket.disconnect();
  });
});
