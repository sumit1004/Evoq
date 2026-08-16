import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { errorResponses } from '../errors/AppError.js';
import * as communicationService from '../services/communicationService.js';
import { emitRealtime, realtimeRooms, setRealtimeServer } from '../utils/realtimeHub.js';

function parseUser(token) {
  const payload = jwt.verify(token, config.jwtSecret);
  const id = Number(payload.sub);
  if (!Number.isSafeInteger(id) || id <= 0 || !['PLAYER', 'ORGANIZER', 'ADMIN'].includes(payload.role)) throw new Error('Invalid socket identity');
  return { id, role: payload.role };
}

export function registerSocketHandlers(io) {
  setRealtimeServer(io);
  io.use((socket, next) => {
    try { const token = socket.handshake.auth?.token; if (!token) return next(errorResponses.authenticationRequired()); socket.data.user = parseUser(token); return next(); } catch { return next(errorResponses.invalidToken()); }
  });
  io.on('connection', (socket) => {
    const chatAttempts = [];
    socket.join(realtimeRooms.user(socket.data.user.id));
    socket.emit('connected', { socketId: socket.id });
    socket.on('join_tournament', async (tournamentId, callback = () => {}) => { try { if (!(await communicationService.canJoinTournament(Number(tournamentId), socket.data.user.id))) throw errorResponses.forbidden(); socket.join(realtimeRooms.tournament(tournamentId)); callback({ ok: true }); } catch (error) { callback({ ok: false, error: error.message }); } });
    socket.on('join_group', async (groupId, callback = () => {}) => { try { if (!(await communicationService.canJoinGroup(Number(groupId), socket.data.user.id))) throw errorResponses.forbidden(); socket.join(realtimeRooms.group(groupId)); callback({ ok: true }); } catch (error) { callback({ ok: false, error: error.message }); } });
    socket.on('leave_tournament', (tournamentId) => { socket.leave(realtimeRooms.tournament(tournamentId)); });
    socket.on('leave_group', (groupId) => { socket.leave(realtimeRooms.group(groupId)); });
    socket.on('send_message', async (payload, callback = () => {}) => { try { const now = Date.now(); while (chatAttempts[0] && now - chatAttempts[0] > 10_000) chatAttempts.shift(); if (chatAttempts.length >= 30) { callback({ ok: false, error: 'Too many chat messages. Please slow down.' }); return; } chatAttempts.push(now); const message = await communicationService.sendChat(Number(payload?.groupId), payload?.message, socket.data.user.id); emitRealtime(realtimeRooms.group(payload.groupId), 'chat_message', message); callback({ ok: true, message }); } catch (error) { callback({ ok: false, error: error.message }); } });
  });
}
