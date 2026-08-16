import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/teamRepository.js', () => ({
  createTeam: vi.fn(),
  deleteTeam: vi.fn(),
  findTeamForUser: vi.fn(),
  getTeamOwner: vi.fn(),
  listTeamsForUser: vi.fn(),
  resolvePlayerIds: vi.fn(),
}));

const repository = await import('../repositories/teamRepository.js');
const { createMyTeam, deleteMyTeam, getMyTeam } = await import('./teamService.js');

describe('team service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves player IDs and creates the owner membership transactionally', async () => {
    repository.resolvePlayerIds.mockResolvedValue([
      { id: 9, unique_player_id: 'EVQ-MEMBER' },
    ]);
    repository.createTeam.mockResolvedValue(21);
    repository.findTeamForUser.mockResolvedValue([
      { id: 21, name: 'Alpha', owner_id: 4, owner_name: 'Owner', member_id: 4, member_name: 'Owner', member_email: 'owner@example.com', member_role: 'OWNER', unique_player_id: 'EVQ-OWNER' },
      { id: 21, name: 'Alpha', owner_id: 4, owner_name: 'Owner', member_id: 9, member_name: 'Member', member_email: 'member@example.com', member_role: 'MEMBER', unique_player_id: 'EVQ-MEMBER' },
    ]);

    const result = await createMyTeam({ name: ' Alpha ', memberPlayerIds: ['evq-member'] }, 4);

    expect(repository.resolvePlayerIds).toHaveBeenCalledWith(['EVQ-MEMBER']);
    expect(repository.createTeam).toHaveBeenCalledWith({ name: 'Alpha', ownerId: 4, memberIds: [9] });
    expect(result.members).toHaveLength(2);
  });

  it('rejects unknown IDs and attempts to list the owner as a member', async () => {
    repository.resolvePlayerIds.mockResolvedValue([]);
    await expect(createMyTeam({ name: 'Alpha', memberPlayerIds: ['EVQ-MISSING'] }, 4))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    repository.resolvePlayerIds.mockResolvedValue([{ id: 4, unique_player_id: 'EVQ-OWNER' }]);
    await expect(createMyTeam({ name: 'Alpha', memberPlayerIds: ['EVQ-OWNER'] }, 4))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('allows only the owner to delete and blocks registered teams safely', async () => {
    repository.getTeamOwner.mockResolvedValue({ id: 21, owner_id: 4, name: 'Alpha' });
    await expect(deleteMyTeam(21, 8)).rejects.toMatchObject({ code: 'FORBIDDEN' });

    repository.deleteTeam.mockRejectedValue({ code: 'ER_ROW_IS_REFERENCED_2' });
    await expect(deleteMyTeam(21, 4)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('does not expose another player team to a non-member', async () => {
    repository.findTeamForUser.mockResolvedValue([]);
    await expect(getMyTeam(21, 8)).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });
});
