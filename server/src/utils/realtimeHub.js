let ioInstance;
export const realtimeEvents = Object.freeze({
  announcement: 'announcement',
  notification: 'notification',
  leaderboardUpdate: 'leaderboard_update',
  resultUpload: 'result_upload',
  roomUpdated: 'room_updated',
  chatMessage: 'chat_message',
});

export const realtimeRooms = Object.freeze({
  user: (id) => `user_${Number(id)}`,
  tournament: (id) => `tournament_${Number(id)}`,
  group: (id) => `group_${Number(id)}`,
});

export function setRealtimeServer(io) { ioInstance = io; }
export function emitRealtime(room, event, payload) { ioInstance?.to(room).emit(event, payload); }
export function getRealtimeServer() { return ioInstance; }
