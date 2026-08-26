import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/resultsRepository.js', () => ({
  getMatchContext: vi.fn(), getGroupContext: vi.fn(), getRoundContext: vi.fn(), getTournamentContext: vi.fn(),
  isPlayerAssignedToGroup: vi.fn(), isPlayerAssignedToRound: vi.fn(), isPlayerAssignedToTournament: vi.fn(),
  getTeamInMatchGroup: vi.fn(), findResult: vi.fn(), insertResult: vi.fn(), listMatchResults: vi.fn(),
  replaceLeaderboard: vi.fn(), listMatchLeaderboard: vi.fn(), listGroupLeaderboard: vi.fn(), listRoundLeaderboard: vi.fn(),
  listTournamentResults: vi.fn(), listTournamentLeaderboard: vi.fn(), listQualifications: vi.fn(), getTeamInRound: vi.fn(),
  insertQualification: vi.fn(), deleteQualification: vi.fn(), countQualifications: vi.fn(),
}));

vi.mock('../repositories/competitionRepository.js', () => ({
  listGroups: vi.fn(),
  countIncompleteGroups: vi.fn(),
}));

import * as repository from '../repositories/resultsRepository.js';
import * as compRepo from '../repositories/competitionRepository.js';
import { createMatchResult, finalizeQualifications, getMatchLeaderboard, selectQualification } from './resultsService.js';


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

  it('creates a valid result including zero kills and numeric string inputs', async () => {
    repository.getMatchContext.mockResolvedValue({ id: 3, group_id: 2, round_id: 1, status: 'LIVE', organizer_id: 8, tournament_status: 'LIVE' });
    repository.getTeamInMatchGroup.mockResolvedValue({ team_id: 5, group_id: 2 });
    repository.findResult.mockResolvedValue(null);
    repository.insertResult.mockResolvedValue(42);
    repository.listMatchResults.mockResolvedValue([{
      id: 42, match_id: 3, group_id: 2, team_id: 5, team_name: 'Team Alpha', points: 15, kills: 0, placement: 1, result_text: null, media_path: null, uploaded_by: 8
    }]);

    const result = await createMatchResult(3, { teamId: '5', points: '15', kills: '0', placement: '1' }, 8);
    expect(result).toMatchObject({
      id: 42,
      matchId: 3,
      teamId: 5,
      points: 15,
      kills: 0,
      placement: 1,
    });
    expect(repository.insertResult).toHaveBeenCalledWith({
      matchId: 3,
      teamId: 5,
      points: 15,
      kills: 0,
      placement: 1,
      resultText: null,
      uploadedBy: 8,
      mediaPath: null,
    });
  });

  it('rejects finalizeQualifications if incomplete groups exist', async () => {
    repository.getRoundContext.mockResolvedValue({ id: 1, status: 'IN_PROGRESS', organizer_id: 8, tournament_status: 'LIVE', round_number: 1, tournament_id: 2 });
    compRepo.countIncompleteGroups.mockResolvedValue(1);
    await expect(finalizeQualifications(1, { selections: [{ teamId: 1, sourceGroupId: 10 }] }, 8)).rejects.toMatchObject({
      status: 409,
      message: 'Every group must be completed before finalizing qualifications',
    });
  });
});


