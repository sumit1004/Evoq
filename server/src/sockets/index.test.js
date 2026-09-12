import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import { config } from '../config/env.js';
import { registerSocketHandlers } from './index.js';

function fakeIo() { return { middleware: null, connection: null, use(handler) { this.middleware = handler; }, on(_event, handler) { this.connection = handler; } }; }

describe('Socket.IO authentication boundary', () => {
  it('rejects a socket without a JWT', async () => {
    const io = fakeIo(); registerSocketHandlers(io);
    await new Promise((resolve) => io.middleware({ handshake: { auth: {} } }, (error) => { expect(error.code).toBe('AUTHENTICATION_REQUIRED'); resolve(); }));
  });
  it('attaches only validated identity claims to an authenticated socket', async () => {
    const io = fakeIo(); registerSocketHandlers(io); const token = jwt.sign({ sub: '3', role: 'ORGANIZER', extra: 'ignored' }, config.jwtSecret); const socket = { handshake: { auth: { token } }, data: {}, join() {}, emit() {}, on() {} };
    await new Promise((resolve) => io.middleware(socket, (error) => { expect(error).toBeUndefined(); resolve(); }));
    io.connection(socket);
    expect(socket.data.user).toEqual({ id: 3, role: 'ORGANIZER' });
  });

  it('handles invalid or non-existent tournament join requests safely', async () => {
    const io = fakeIo();
    registerSocketHandlers(io);
    const token = jwt.sign({ sub: '3', role: 'ORGANIZER' }, config.jwtSecret);

    let joinTournamentHandler;
    const socket = {
      handshake: { auth: { token } },
      data: {},
      join: vi.fn(),
      emit: vi.fn(),
      on(event, handler) {
        if (event === 'join_tournament') joinTournamentHandler = handler;
      },
    };

    await new Promise((resolve) => io.middleware(socket, () => resolve()));
    io.connection(socket);

    expect(typeof joinTournamentHandler).toBe('function');

    // Test malformed ID
    const callback1 = vi.fn();
    await joinTournamentHandler('invalid-abc', callback1);
    expect(callback1).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));

    // Test non-existent ID (99999)
    const callback2 = vi.fn();
    await joinTournamentHandler(99999, callback2);
    expect(callback2).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  it('handles invalid or non-existent group join requests safely', async () => {
    const io = fakeIo();
    registerSocketHandlers(io);
    const token = jwt.sign({ sub: '3', role: 'ORGANIZER' }, config.jwtSecret);

    let joinGroupHandler;
    const socket = {
      handshake: { auth: { token } },
      data: {},
      join: vi.fn(),
      emit: vi.fn(),
      on(event, handler) {
        if (event === 'join_group') joinGroupHandler = handler;
      },
    };

    await new Promise((resolve) => io.middleware(socket, () => resolve()));
    io.connection(socket);

    expect(typeof joinGroupHandler).toBe('function');

    // Test malformed group ID
    const callback1 = vi.fn();
    await joinGroupHandler(null, callback1);
    expect(callback1).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));

    // Test non-existent group ID (99999)
    const callback2 = vi.fn();
    await joinGroupHandler(99999, callback2);
    expect(callback2).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });
});
