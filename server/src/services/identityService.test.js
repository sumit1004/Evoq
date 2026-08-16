import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/identityRepository.js', () => ({
  createIdentity: vi.fn(),
  findProfileByUserId: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  updateIdentityProfile: vi.fn(),
}));

const repository = await import('../repositories/identityRepository.js');
const { config } = await import('../config/env.js');
const { login, signup } = await import('./identityService.js');

describe('identity service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a player with a generated player profile and JWT', async () => {
    repository.createIdentity.mockResolvedValue({ id: 7 });
    repository.findUserById.mockResolvedValue({
      id: 7, name: 'Player One', email: 'player@example.com', role: 'PLAYER', created_at: null, updated_at: null,
    });
    repository.findProfileByUserId.mockImplementation(async (id) => ({
      user_id: id, unique_player_id: 'EVQ-TEST', mobile: null, in_game_name: 'P1', game_uid: 'UID-1',
    }));

    const result = await signup({ name: 'Player One', email: 'PLAYER@example.com', password: 'password123' });
    const claims = jwt.verify(result.token, config.jwtSecret);

    expect(repository.createIdentity).toHaveBeenCalledWith(expect.objectContaining({
      email: 'player@example.com', role: 'PLAYER',
      profile: expect.objectContaining({ uniquePlayerId: expect.stringMatching(/^EVQ-/) }),
    }));
    expect(claims.sub).toBe('7');
    expect(result.identity.profile.uniquePlayerId).toBe('EVQ-TEST');
    expect(result.identity.password_hash).toBeUndefined();
  });

  it('rejects invalid credentials without revealing which field failed', async () => {
    repository.findUserByEmail.mockResolvedValue({
      id: 7, password_hash: await bcrypt.hash('correct-password', 4), role: 'PLAYER',
    });

    await expect(login({ email: 'player@example.com', password: 'wrong-password' }))
      .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', status: 401 });
  });

  it('does not allow duplicate identity records to leak database errors', async () => {
    repository.createIdentity.mockRejectedValue({ code: 'ER_DUP_ENTRY' });

    await expect(signup({ name: 'Player One', email: 'player@example.com', password: 'password123' }))
      .rejects.toMatchObject({ code: 'CONFLICT', status: 409 });
  });
});
