import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/resultsRepository.js', () => ({
  getMatchContext: vi.fn(), getGroupContext: vi.fn(), getRoundContext: vi.fn(), getTournamentContext: vi.fn(),
  isPlayerAssignedToGroup: vi.fn(), isPlayerAssignedToRound: vi.fn(), isPlayerAssignedToTournament: vi.fn(),
  getTeamInMatchGroup: vi.fn(), findResult: vi.fn(), insertResult: vi.fn(), updateResult: vi.fn(), listMatchResults: vi.fn(),
  replaceLeaderboard: vi.fn(), listMatchLeaderboard: vi.fn(), listGroupLeaderboard: vi.fn(), listRoundLeaderboard: vi.fn(),
  listTournamentResults: vi.fn(), listTournamentLeaderboard: vi.fn(), listQualifications: vi.fn(), getTeamInRound: vi.fn(),
  insertQualification: vi.fn(), deleteQualification: vi.fn(), countQualifications: vi.fn(),
}));

vi.mock('../repositories/scoringRepository.js', () => ({
  findScoringConfig: vi.fn(),
  listPositionPoints: vi.fn(),
  saveScoringConfig: vi.fn(),
  getTournamentContext: vi.fn(),
}));

vi.mock('../repositories/competitionRepository.js', () => ({
  listGroups: vi.fn(),
  countIncompleteGroups: vi.fn(),
}));

import * as repository from '../repositories/resultsRepository.js';
import * as scoringRepo from '../repositories/scoringRepository.js';
import * as compRepo from '../repositories/competitionRepository.js';
import { createMatchResult, finalizeQualifications, getGroupLeaderboard, getMatchLeaderboard, getTournamentLeaderboard, selectQualification } from './resultsService.js';


describe('results and qualification rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scoringRepo.getTournamentContext.mockResolvedValue({ id: 1, organizer_id: 8, status: 'LIVE' });
    scoringRepo.findScoringConfig.mockResolvedValue(null);
    scoringRepo.listPositionPoints.mockResolvedValue([]);
  });

  it('rejects a result from a team outside the match group', async () => {
    repository.getMatchContext.mockResolvedValue({ id: 5, group_id: 2, round_id: 1, tournament_id: 1, status: 'LIVE', organizer_id: 8, tournament_status: 'LIVE' });
    repository.getTeamInMatchGroup.mockResolvedValue(null);
    await expect(createMatchResult(5, { teamId: 99, points: 1, kills: 0 }, 8)).rejects.toMatchObject({ status: 400 });
  });

  it('updates existing result when a result already exists for the match and team', async () => {
    repository.getMatchContext.mockResolvedValue({ id: 5, group_id: 2, round_id: 1, tournament_id: 1, status: 'LIVE', organizer_id: 8, tournament_status: 'LIVE' });
    repository.getTeamInMatchGroup.mockResolvedValue({ team_id: 4, group_id: 2 });
    repository.findResult.mockResolvedValue({ id: 10 });
    repository.listMatchResults.mockResolvedValue([{
      id: 10, match_id: 5, group_id: 2, team_id: 4, team_name: 'Team Delta', points: 12, kills: 0, placement: 1, result_text: null, media_path: null, uploaded_by: 8
    }]);
    repository.listMatchLeaderboard.mockResolvedValue([]);

    const result = await createMatchResult(5, { teamId: 4, kills: 0, placement: 1 }, 8);
    expect(repository.updateResult).toHaveBeenCalled();
    expect(result.id).toBe(10);
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

  it('creates a valid result calculating kill points and position points in KILLS_AND_POSITION mode', async () => {
    repository.getMatchContext.mockResolvedValue({ id: 3, group_id: 2, round_id: 1, tournament_id: 1, status: 'LIVE', organizer_id: 8, tournament_status: 'LIVE' });
    repository.getTeamInMatchGroup.mockResolvedValue({ team_id: 5, group_id: 2 });
    repository.findResult.mockResolvedValue(null);
    repository.insertResult.mockResolvedValue(42);
    repository.listMatchResults.mockResolvedValue([{
      id: 42, match_id: 3, group_id: 2, team_id: 5, team_name: 'Team Alpha', points: 22, kills: 10, placement: 1, kill_points: 10, position_points: 12, result_text: null, media_path: null, uploaded_by: 8
    }]);
    repository.listMatchLeaderboard.mockResolvedValue([]);

    const result = await createMatchResult(3, { teamId: '5', kills: '10', placement: '1' }, 8);
    expect(result).toMatchObject({
      id: 42,
      matchId: 3,
      teamId: 5,
      points: 22,
      kills: 10,
      placement: 1,
      killPoints: 10,
      positionPoints: 12,
    });
    expect(repository.insertResult).toHaveBeenCalledWith({
      matchId: 3,
      teamId: 5,
      points: 22,
      kills: 10,
      placement: 1,
      killPoints: 10,
      positionPoints: 12,
      resultText: null,
      uploadedBy: 8,
      mediaPath: null,
    });
  });

  it('returns group leaderboard with rank, team, kills, position, and points', async () => {
    repository.getGroupContext.mockResolvedValue({ id: 10, round_id: 1, tournament_id: 2, organizer_id: 8, status: 'LIVE' });
    repository.listGroupLeaderboard.mockResolvedValue([
      { group_id: 10, team_id: 1, team_name: 'Team Alpha', points: 45, kills: 21, placement: 1, matches_played: 1 },
      { group_id: 10, team_id: 2, team_name: 'Team Bravo', points: 39, kills: 18, placement: 3, matches_played: 1 }
    ]);

    const result = await getGroupLeaderboard(10, 8);
    expect(result).toEqual([
      { groupId: 10, teamId: 1, teamName: 'Team Alpha', points: 45, kills: 21, position: 1, placement: 1, rank: 1, matchesPlayed: 1 },
      { groupId: 10, teamId: 2, teamName: 'Team Bravo', points: 39, kills: 18, position: 3, placement: 3, rank: 2, matchesPlayed: 1 }
    ]);
  });

  it('returns tournament leaderboard with rank, team, kills, position, and points', async () => {
    repository.getTournamentContext.mockResolvedValue({ id: 2, organizer_id: 8, status: 'LIVE' });
    repository.listTournamentLeaderboard.mockResolvedValue([
      { tournament_id: 2, team_id: 1, team_name: 'Team Alpha', points: 90, kills: 42, placement: 1, matches_played: 2 }
    ]);

    const result = await getTournamentLeaderboard(2, 8);
    expect(result).toEqual([
      { teamId: 1, teamName: 'Team Alpha', points: 90, kills: 42, position: 1, placement: 1, rank: 1, matchesPlayed: 2 }
    ]);
  });
});


