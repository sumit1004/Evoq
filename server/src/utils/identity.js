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

export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const [localPart, domain] = email.split('@');
  if (!domain) return email;
  const maskedLocal = localPart.length > 2
    ? `${localPart[0]}${'*'.repeat(Math.min(localPart.length - 2, 5))}${localPart[localPart.length - 1]}`
    : `${localPart[0]}*`;
  return `${maskedLocal}@${domain}`;
}
