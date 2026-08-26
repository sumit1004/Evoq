import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { errorResponses } from '../errors/AppError.js';
import * as communicationService from '../services/communicationService.js';
import { emitRealtime, realtimeRooms, setRealtimeServer } from '../utils/realtimeHub.js';
import { logger } from '../utils/logger.js';

function parseUser(token) {
  if (!token || typeof token !== 'string') {
    throw errorResponses.authenticationRequired();
  }
  const payload = jwt.verify(token, config.jwtSecret);
  const id = Number(payload.sub);
  if (!Number.isSafeInteger(id) || id <= 0 || !['PLAYER', 'ORGANIZER', 'ADMIN'].includes(payload.role)) {
    throw new Error('Invalid socket identity');
  }
  return { id, role: payload.role };
}

function safeCallback(callback, data) {
  if (typeof callback === 'function') {
    try {
      callback(data);
    } catch (err) {
      logger.error('socket_callback_error', { message: err?.message });
    }
  }
}

export function registerSocketHandlers(io) {
  setRealtimeServer(io);

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(errorResponses.authenticationRequired());
      }
      socket.data.user = parseUser(token);
      return next();
    } catch {
      return next(errorResponses.invalidToken());
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data?.user;
    if (!user?.id) {
      socket.disconnect(true);
      return;
    }

    const chatAttempts = [];
    socket.join(realtimeRooms.user(user.id));
    socket.emit('connected', { socketId: socket.id });

    socket.on('join_tournament', async (tournamentId, callback) => {
      try {
        const canJoin = await communicationService.canJoinTournament(Number(tournamentId), user.id);
        if (!canJoin) throw errorResponses.forbidden();
        socket.join(realtimeRooms.tournament(tournamentId));
        safeCallback(callback, { ok: true });
      } catch (error) {
        safeCallback(callback, { ok: false, error: error.message || 'Unable to join tournament' });
      }
    });

    socket.on('join_group', async (groupId, callback) => {
      try {
        const canJoin = await communicationService.canJoinGroup(Number(groupId), user.id);
        if (!canJoin) throw errorResponses.forbidden();
        socket.join(realtimeRooms.group(groupId));
        safeCallback(callback, { ok: true });
      } catch (error) {
        safeCallback(callback, { ok: false, error: error.message || 'Unable to join group' });
      }
    });

    socket.on('leave_tournament', (tournamentId) => {
      try {
        socket.leave(realtimeRooms.tournament(tournamentId));
      } catch {
        // Safe leave
      }
    });

    socket.on('leave_group', (groupId) => {
      try {
        socket.leave(realtimeRooms.group(groupId));
      } catch {
        // Safe leave
      }
    });

    socket.on('send_message', async (payload, callback) => {
      try {
        const now = Date.now();
        while (chatAttempts[0] && now - chatAttempts[0] > 10_000) {
          chatAttempts.shift();
        }
        if (chatAttempts.length >= 30) {
          safeCallback(callback, { ok: false, error: 'Too many chat messages. Please slow down.' });
          return;
        }
        chatAttempts.push(now);

        const groupId = Number(payload?.groupId);
        const messageText = payload?.message;
        const message = await communicationService.sendChat(groupId, messageText, user.id);
        emitRealtime(realtimeRooms.group(payload.groupId), 'chat_message', message);
        safeCallback(callback, { ok: true, message });
      } catch (error) {
        safeCallback(callback, { ok: false, error: error.message || 'Unable to send message' });
      }
    });

    socket.on('error', (err) => {
      logger.error('socket_client_error', { socketId: socket.id, message: err?.message });
    });
  });
}

