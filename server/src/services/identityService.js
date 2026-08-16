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
  return jwt.sign({ role: user.role }, config.jwtSecret, {
    subject: String(user.id),
    expiresIn: config.jwtExpiresIn,
  });
}

async function getIdentity(userId) {
  const user = await findUserById(userId);
  if (!user) {
    throw errorResponses.authenticationRequired();
  }
  const profile = user.role === 'PLAYER' ? await findProfileByUserId(user.id) : null;
  return { user, profile };
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
    return { token: createAccessToken(identity.user), identity: serializeIdentity(identity.user, identity.profile) };
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

  const profile = user.role === 'PLAYER' ? await findProfileByUserId(user.id) : null;
  return { token: createAccessToken(user), identity: serializeIdentity(user, profile) };
}

export async function getCurrentIdentity(userId) {
  const identity = await getIdentity(userId);
  return serializeIdentity(identity.user, identity.profile);
}

export async function updateCurrentProfile(userId, updates) {
  await updateIdentityProfile(userId, {
    ...updates,
    name: updates.name?.trim(),
  });
  return getCurrentIdentity(userId);
}
