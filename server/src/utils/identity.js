import { randomUUID } from 'node:crypto';

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export function generateUniquePlayerId() {
  return `EVQ-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
}

export function serializeIdentity(user, profile = null, extra = {}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isScout: Boolean(extra.isScout),
    scoutCount: Number(extra.scoutCount || 0),
    scoutAssignments: Array.isArray(extra.scoutAssignments) ? extra.scoutAssignments : [],
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    profile: profile
      ? {
          uniquePlayerId: profile.unique_player_id,
          mobile: profile.mobile,
          inGameName: profile.in_game_name,
          gameUid: profile.game_uid,
        }
      : null,
  };
}
