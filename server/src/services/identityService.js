import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { errorResponses } from '../errors/AppError.js';
import {
  createIdentity,
  findProfileByUserId,
  findUserByEmail,
  findUserById,
  updateIdentityProfile,
} from '../repositories/identityRepository.js';
import { generateUniquePlayerId, normalizeEmail, serializeIdentity } from '../utils/identity.js';

const passwordCost = 12;

function isDuplicateError(error) {
  return error?.code === 'ER_DUP_ENTRY';
}

function createAccessToken(user) {
  return jwt.sign({ role: user.role, tokenVersion: user.token_version || 1 }, config.jwtSecret, {
    subject: String(user.id),
    expiresIn: config.jwtExpiresIn,
  });
}

import { listScoutAssignedTournaments } from '../repositories/staffRepository.js';

async function getIdentity(userId) {
  const user = await findUserById(userId);
  if (!user) {
    throw errorResponses.authenticationRequired();
  }
  const profile = user.role === 'PLAYER' ? await findProfileByUserId(user.id) : null;
  let scoutAssignments = [];
  try {
    scoutAssignments = await listScoutAssignedTournaments(userId);
  } catch {
    scoutAssignments = [];
  }
  const isScout = scoutAssignments.length > 0;
  const scoutCount = scoutAssignments.length;
  return { user, profile, isScout, scoutCount, scoutAssignments };
}

export async function signup(input) {
  const role = input.role || 'PLAYER';
  const email = normalizeEmail(input.email);
  const passwordHash = await bcrypt.hash(input.password, passwordCost);
  const profile = role === 'PLAYER' ? { uniquePlayerId: generateUniquePlayerId(), ...input } : null;

  try {
    const created = await createIdentity({
      name: input.name.trim(),
      email,
      passwordHash,
      role,
      profile,
    });
    const identity = await getIdentity(created.id);
    return {
      token: createAccessToken(identity.user),
      identity: serializeIdentity(identity.user, identity.profile, {
        isScout: identity.isScout,
        scoutCount: identity.scoutCount,
        scoutAssignments: identity.scoutAssignments,
      }),
    };
  } catch (error) {
    if (isDuplicateError(error)) {
      throw errorResponses.conflict('An account with that email or player ID already exists');
    }
    throw error;
  }
}

export async function login({ email, password }) {
  const user = await findUserByEmail(normalizeEmail(email));
  const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!valid) {
    throw errorResponses.invalidCredentials();
  }

  const identity = await getIdentity(user.id);
  return {
    token: createAccessToken(user),
    identity: serializeIdentity(user, identity.profile, {
      isScout: identity.isScout,
      scoutCount: identity.scoutCount,
      scoutAssignments: identity.scoutAssignments,
    }),
  };
}

export async function getCurrentIdentity(userId) {
  const identity = await getIdentity(userId);
  return serializeIdentity(identity.user, identity.profile, {
    isScout: identity.isScout,
    scoutCount: identity.scoutCount,
    scoutAssignments: identity.scoutAssignments,
  });
}

export async function updateCurrentProfile(userId, updates) {
  await updateIdentityProfile(userId, {
    ...updates,
    name: updates.name?.trim(),
  });
  return getCurrentIdentity(userId);
}
