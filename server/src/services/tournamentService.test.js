import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/tournamentRepository.js', () => ({
  createTournament: vi.fn(),
  findTournament: vi.fn(),
  listPrizes: vi.fn(),
  listTournaments: vi.fn(),
  updateTournament: vi.fn(),
}));
vi.mock('../repositories/staffRepository.js', () => ({
  ensureDefaultOrganization: vi.fn().mockResolvedValue({ id: 1, name: 'Default Org' }),
  getScoutPermissionsAndGroups: vi.fn().mockResolvedValue(null),
}));

const repository = await import('../repositories/tournamentRepository.js');
const { createOrganizerTournament, updateOrganizerTournament } = await import('./tournamentService.js');

describe('tournament service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates organizer-owned tournaments with normalized free entry fees', async () => {
    repository.createTournament.mockResolvedValue(8);
    repository.findTournament.mockResolvedValue({ id: 8, organizer_id: 4, name: 'Cup', status: 'DRAFT' });
    repository.listPrizes.mockResolvedValue([]);

    const result = await createOrganizerTournament({ name: 'Cup', entryType: 'FREE', entryFee: 999 }, 4);

    expect(repository.createTournament).toHaveBeenCalledWith(expect.objectContaining({ organizerId: 4, entryFee: 0 }));
    expect(result.id).toBe(8);
  });

  it('enforces the forward-only lifecycle', async () => {
    repository.findTournament.mockResolvedValue({ id: 8, organizer_id: 4, name: 'Cup', status: 'REGISTRATION_OPEN' });

    await expect(updateOrganizerTournament(8, { status: 'LIVE' }, 4))
      .rejects.toMatchObject({ code: 'CONFLICT', status: 409 });
    await expect(updateOrganizerTournament(8, { status: 'REGISTRATION_CLOSED' }, 9))
      .rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('locks completed tournaments', async () => {
    repository.findTournament.mockResolvedValue({ id: 8, organizer_id: 4, name: 'Cup', status: 'COMPLETED' });

    await expect(updateOrganizerTournament(8, { name: 'Changed' }, 4))
      .rejects.toMatchObject({ code: 'CONFLICT', status: 409 });
  });
});
