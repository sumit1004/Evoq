import http from 'node:http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import { describe, expect, it, beforeAll, beforeEach, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { config } from '../../config/env.js';
import { registerSocketHandlers } from '../../sockets/index.js';
import {
  setupTestDatabase,
  truncateAllTables,
  closeTestDatabase,
  createTestUser,
  createTestTeam,
  createTestTournament,
  getTestPool,
} from '../testEnvironment.js';

describe('REAL Socket.IO & Real Database Integration', () => {
  let server;
  let io;
  let serverPort;

  beforeAll(async () => {
    await setupTestDatabase();
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

  function createClientSocket(token) {
    return Client(`http://127.0.0.1:${serverPort}`, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    });
  }

  it('authenticates real socket client with valid JWT and rejects expired or invalid JWTs', async () => {
    const user = await createTestUser({ role: 'PLAYER' });

    // 1. Valid Token Connects
    const validSocket = createClientSocket(user.token);
    await new Promise((resolve, reject) => {
      validSocket.on('connect', resolve);
      validSocket.on('connect_error', reject);
    });
    expect(validSocket.connected).toBe(true);
    validSocket.disconnect();

    // 2. Expired Token Rejected
    const expiredToken = jwt.sign({ role: 'PLAYER', tokenVersion: 1 }, config.jwtSecret, {
      subject: String(user.id),
      expiresIn: '-10s',
    });
    const expiredSocket = createClientSocket(expiredToken);
    const expiredErr = await new Promise((resolve) => {
      expiredSocket.on('connect_error', resolve);
    });
    expect(expiredErr).toBeDefined();
    expiredSocket.disconnect();

    // 3. Revoked tokenVersion Rejected
    const revokedToken = jwt.sign({ role: 'PLAYER', tokenVersion: 99 }, config.jwtSecret, {
      subject: String(user.id),
      expiresIn: '1h',
    });
    const revokedSocket = createClientSocket(revokedToken);
    const revokedErr = await new Promise((resolve) => {
      revokedSocket.on('connect_error', resolve);
    });
    expect(revokedErr).toBeDefined();
    revokedSocket.disconnect();
  });

  it('allows authorized tournament and group room joining and delivers persisted group chat messages', async () => {
    const organizer = await createTestUser({ role: 'ORGANIZER' });
    const tournament = await createTestTournament(organizer.id, { status: 'LIVE' });

    const p1 = await createTestUser({ name: 'Gamer One', role: 'PLAYER' });
    const team1 = await createTestTeam(p1.id, { name: 'Chat Champs' });

    const pool = getTestPool();
    // Register & verify
    await pool.query('INSERT INTO registrations (tournament_id, team_id, status) VALUES (?, ?, "VERIFIED")', [tournament.id, team1.id]);
    const [rRes] = await pool.query('INSERT INTO rounds (tournament_id, round_number, name, status, is_locked) VALUES (?, 1, "R1", "IN_PROGRESS", 1)', [tournament.id]);
    const roundId = rRes.insertId;
    const [gRes] = await pool.query('INSERT INTO `groups` (round_id, name, group_size, status) VALUES (?, "Group Alpha", 12, "IN_PROGRESS")', [roundId]);
    const groupId = gRes.insertId;
    await pool.query('INSERT INTO group_teams (group_id, team_id) VALUES (?, ?)', [groupId, team1.id]);

    // Connect Organizer Socket
    const orgSocket = createClientSocket(organizer.token);
    await new Promise((resolve) => orgSocket.on('connect', resolve));

    // Connect Player Socket
    const playerSocket = createClientSocket(p1.token);
    await new Promise((resolve) => playerSocket.on('connect', resolve));

    // 1. Organizer joins tournament room
    const joinTourneyRes = await new Promise((resolve) => {
      orgSocket.emit('join_tournament', tournament.id, resolve);
    });
    expect(joinTourneyRes.ok).toBe(true);

    // 2. Player joins group room
    const joinGroupRes = await new Promise((resolve) => {
      playerSocket.emit('join_group', groupId, resolve);
    });
    expect(joinGroupRes.ok).toBe(true);

    // 3. Send message via Socket and verify real MySQL persistence and broadcast
    const messagePromise = new Promise((resolve) => {
      playerSocket.on('chat_message', resolve);
    });

    const sendRes = await new Promise((resolve) => {
      playerSocket.emit('send_message', { groupId, message: 'Good luck everyone!' }, resolve);
    });
    expect(sendRes.ok).toBe(true);
    expect(sendRes.message.message).toBe('Good luck everyone!');

    const receivedMessage = await messagePromise;
    expect(receivedMessage.message).toBe('Good luck everyone!');

    // Verify persisted directly into MySQL chat_messages table
    const [chatDb] = await pool.query('SELECT * FROM chat_messages WHERE group_id = ?', [groupId]);
    expect(chatDb).toHaveLength(1);
    expect(chatDb[0].message).toBe('Good luck everyone!');
    expect(chatDb[0].sender_id).toBe(p1.id);

    // Cleanup
    orgSocket.disconnect();
    playerSocket.disconnect();
  });
});
