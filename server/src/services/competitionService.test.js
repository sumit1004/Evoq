import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../repositories/competitionRepository.js', () => ({
  getTournamentContext: vi.fn(), getRoundContext: vi.fn(), getGroupContext: vi.fn(), getMatchContext: vi.fn(),
  listRounds: vi.fn(), findRound: vi.fn(), createRound: vi.fn(), updateRound: vi.fn(), countIncompleteGroups: vi.fn(),
  listGroups: vi.fn(), findGroup: vi.fn(), createGroup: vi.fn(), updateGroup: vi.fn(), countIncompleteMatches: vi.fn(),
  assignTeam: vi.fn(), removeTeam: vi.fn(), listMatches: vi.fn(), findMatch: vi.fn(), createMatch: vi.fn(), updateMatch: vi.fn(), isPlayerAssignedToGroup: vi.fn(), listEligibleTeams: vi.fn(),
}));

import * as repository from '../repositories/competitionRepository.js';
import { assignVerifiedTeam, completeRound, createTournamentRound, updateRoundStatus, updateRoundGroup, updateGroupMatch } from './competitionService.js';

describe('competition service lifecycle and ownership', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hides rounds from a different organizer', async () => {
    repository.getRoundContext.mockResolvedValue({ id: 4, organizer_id: 8, status: 'NOT_STARTED', tournament_status: 'LIVE' });
    await expect(updateRoundStatus(4, 'IN_PROGRESS', 9)).rejects.toMatchObject({ status: 404 });
  });

  it('requires a live tournament before creating a round', async () => {
    repository.getTournamentContext.mockResolvedValue({ id: 2, organizer_id: 8, status: 'REGISTRATION_CLOSED' });
    await expect(createTournamentRound(2, { roundNumber: 1, name: 'Round 1' }, 8)).rejects.toMatchObject({ status: 409 });
  });

  it('does not complete a round while groups remain open', async () => {
    repository.getRoundContext.mockResolvedValue({ id: 4, organizer_id: 8, status: 'IN_PROGRESS', tournament_status: 'LIVE' });
    repository.countIncompleteGroups.mockResolvedValue(1);
    await expect(completeRound(4, 8)).rejects.toMatchObject({ status: 409 });
  });

  it('does not complete a group while matches remain open', async () => {
    repository.getGroupContext.mockResolvedValue({ id: 7, organizer_id: 8, status: 'IN_PROGRESS', tournament_status: 'LIVE' });
    repository.countIncompleteMatches.mockResolvedValue(2);
    await expect(updateRoundGroup(7, { status: 'COMPLETED' }, 8)).rejects.toMatchObject({ status: 409 });
  });

  it('rejects backwards match transitions', async () => {
    repository.getMatchContext.mockResolvedValue({ id: 10, organizer_id: 8, status: 'COMPLETED', tournament_status: 'LIVE' });
    await expect(updateGroupMatch(10, { status: 'LIVE' }, 8)).rejects.toMatchObject({ status: 409 });
  });

  it('surfaces group capacity conflicts from the transactional assignment boundary', async () => {
    repository.getGroupContext.mockResolvedValue({ id: 7, organizer_id: 8, status: 'NOT_STARTED', tournament_status: 'LIVE' });
    repository.assignTeam.mockRejectedValue(Object.assign(new Error('This group has reached its maximum capacity'), { code: 'GROUP_CAPACITY' }));
    await expect(assignVerifiedTeam(7, 4, 8)).rejects.toMatchObject({ status: 409, message: 'This group has reached its maximum capacity' });
  });
});
