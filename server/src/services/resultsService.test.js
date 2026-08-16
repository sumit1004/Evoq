import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/resultsRepository.js', () => ({
  getMatchContext: vi.fn(), getGroupContext: vi.fn(), getRoundContext: vi.fn(), getTournamentContext: vi.fn(),
  isPlayerAssignedToGroup: vi.fn(), isPlayerAssignedToRound: vi.fn(), isPlayerAssignedToTournament: vi.fn(),
  getTeamInMatchGroup: vi.fn(), findResult: vi.fn(), insertResult: vi.fn(), listMatchResults: vi.fn(),
  replaceLeaderboard: vi.fn(), listMatchLeaderboard: vi.fn(), listGroupLeaderboard: vi.fn(), listRoundLeaderboard: vi.fn(),
  listTournamentResults: vi.fn(), listTournamentLeaderboard: vi.fn(), listQualifications: vi.fn(), getTeamInRound: vi.fn(),
  insertQualification: vi.fn(), deleteQualification: vi.fn(), countQualifications: vi.fn(),
}));

import * as repository from '../repositories/resultsRepository.js';
import { createMatchResult, getMatchLeaderboard, selectQualification } from './resultsService.js';

describe('results and qualification rules', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a result from a team outside the match group', async () => {
    repository.getMatchContext.mockResolvedValue({ id: 5, group_id: 2, round_id: 1, status: 'LIVE', organizer_id: 8, tournament_status: 'LIVE' });
    repository.getTeamInMatchGroup.mockResolvedValue(null);
    await expect(createMatchResult(5, { teamId: 99, points: 1, kills: 0 }, 8)).rejects.toMatchObject({ status: 400 });
  });

  it('rejects duplicate results for one match and team', async () => {
    repository.getMatchContext.mockResolvedValue({ id: 5, group_id: 2, round_id: 1, status: 'LIVE', organizer_id: 8, tournament_status: 'LIVE' });
    repository.getTeamInMatchGroup.mockResolvedValue({ team_id: 4, group_id: 2 });
    repository.findResult.mockResolvedValue({ id: 10 });
    await expect(createMatchResult(5, { teamId: 4, points: 1, kills: 0 }, 8)).rejects.toMatchObject({ status: 409 });
  });

  it('denies leaderboard reads to an unassigned player', async () => {
    repository.getMatchContext.mockResolvedValue({ id: 5, group_id: 2, status: 'LIVE', organizer_id: 8, tournament_status: 'LIVE' });
    repository.isPlayerAssignedToGroup.mockResolvedValue(false);
    await expect(getMatchLeaderboard(5, 12)).rejects.toMatchObject({ status: 404 });
  });

  it('requires a team assigned in the round for qualification', async () => {
    repository.getRoundContext.mockResolvedValue({ id: 1, status: 'IN_PROGRESS', organizer_id: 8, tournament_status: 'LIVE' });
    repository.getTeamInRound.mockResolvedValue(null);
    await expect(selectQualification(1, { teamId: 44 }, 8)).rejects.toMatchObject({ status: 400 });
  });
});
