import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { errorResponses } from '../errors/AppError.js';
import * as communicationService from '../services/communicationService.js';
import { emitRealtime, realtimeRooms, setRealtimeServer } from '../utils/realtimeHub.js';
import { logger } from '../utils/logger.js';
import { getUserTokenVersion } from '../services/identityService.js';

async function parseUser(token) {
  if (!token || typeof token !== 'string') {
    throw errorResponses.authenticationRequired();
  }
  const payload = jwt.verify(token, config.jwtSecret);
  const id = Number(payload.sub);
  if (!Number.isSafeInteger(id) || id <= 0 || !['PLAYER', 'ORGANIZER', 'ADMIN'].includes(payload.role)) {
    throw new Error('Invalid socket identity');
  }
  const currentVersion = await getUserTokenVersion(id);
  const tokenVersion = Number(payload.tokenVersion) || 1;
  if (currentVersion !== null && tokenVersion !== currentVersion) {
    throw errorResponses.invalidToken();
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

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(errorResponses.authenticationRequired());
      }
      socket.data.user = await parseUser(token);
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
        const id = Number(tournamentId);
        if (!Number.isSafeInteger(id) || id <= 0) {
          safeCallback(callback, { ok: false, error: 'Invalid tournament ID' });
          return;
        }
        const canJoin = await communicationService.canJoinTournament(id, user.id);
        if (!canJoin) throw errorResponses.forbidden();
        socket.join(realtimeRooms.tournament(id));
        safeCallback(callback, { ok: true });
      } catch (error) {
        safeCallback(callback, { ok: false, error: error.message || 'Unable to join tournament' });
      }
    });

    socket.on('join_group', async (groupId, callback) => {
      try {
        const id = Number(groupId);
        if (!Number.isSafeInteger(id) || id <= 0) {
          safeCallback(callback, { ok: false, error: 'Invalid group ID' });
          return;
        }
        const canJoin = await communicationService.canJoinGroup(id, user.id);
        if (!canJoin) throw errorResponses.forbidden();
        socket.join(realtimeRooms.group(id));
        safeCallback(callback, { ok: true });
      } catch (error) {
        safeCallback(callback, { ok: false, error: error.message || 'Unable to join group' });
      }
    });

    socket.on('leave_tournament', (tournamentId) => {
      try {
        const id = Number(tournamentId);
        if (Number.isSafeInteger(id) && id > 0) {
          socket.leave(realtimeRooms.tournament(id));
        }
      } catch {
        // Safe leave
      }
    });

    socket.on('leave_group', (groupId) => {
      try {
        const id = Number(groupId);
        if (Number.isSafeInteger(id) && id > 0) {
          socket.leave(realtimeRooms.group(id));
        }
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
        if (!Number.isSafeInteger(groupId) || groupId <= 0) {
          safeCallback(callback, { ok: false, error: 'Invalid group ID' });
          return;
        }
        const messageText = payload?.message;
        const message = await communicationService.sendChat(groupId, messageText, user.id);
        emitRealtime(realtimeRooms.group(groupId), 'chat_message', message);
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

