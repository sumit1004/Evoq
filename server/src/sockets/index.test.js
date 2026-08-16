import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
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
});
