import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../repositories/competitionRepository.js', () => ({
  getTournamentContext: vi.fn(), getRoundContext: vi.fn(), getGroupContext: vi.fn(), getMatchContext: vi.fn(),
  listRounds: vi.fn(), findRound: vi.fn(), findRoundByNumber: vi.fn(), createRound: vi.fn(), updateRound: vi.fn(), countIncompleteGroups: vi.fn(),
  listGroups: vi.fn(), findGroup: vi.fn(), createGroup: vi.fn(), updateGroup: vi.fn(), countIncompleteMatches: vi.fn(),
  assignTeam: vi.fn(), removeTeam: vi.fn(), listMatches: vi.fn(), findMatch: vi.fn(), createMatch: vi.fn(), updateMatch: vi.fn(), isPlayerAssignedToGroup: vi.fn(), listEligibleTeams: vi.fn(),
  generateRoundGroupsAndAssignments: vi.fn(), bulkMoveTeams: vi.fn(), lockRoundAssignment: vi.fn(), getRoundAffectedPlayers: vi.fn(),
  countMatchResults: vi.fn(), deleteMatch: vi.fn(), countGroupResults: vi.fn(), countGroupQualifications: vi.fn(), deleteGroup: vi.fn(), getRoundStats: vi.fn(), getMatchAffectedPlayers: vi.fn(),
  countRoundResults: vi.fn(), countRoundQualifications: vi.fn(), deleteRound: vi.fn(),
}));

vi.mock('../repositories/resultsRepository.js', () => ({
  listQualifications: vi.fn(),
  countQualifications: vi.fn(),
}));

vi.mock('../repositories/communicationRepository.js', () => ({
  createNotifications: vi.fn(),
}));

vi.mock('../utils/realtimeHub.js', () => ({
  emitRealtime: vi.fn(),
  realtimeEvents: {
    groupAssignmentLocked: 'group_assignment_locked',
    notification: 'notification',
    nextRoundCreated: 'next_round_created',
  },
  realtimeRooms: {
    tournament: vi.fn((id) => `tournament_${id}`),
    user: vi.fn((id) => `user_${id}`),
    group: vi.fn((id) => `group_${id}`),
  },
}));

import * as repository from '../repositories/competitionRepository.js';
import * as resultsRepo from '../repositories/resultsRepository.js';
import {
  assignVerifiedTeam,
  calculateBalancedDistribution,
  autoAssignRoundGroups,
  bulkMoveRoundTeams,
  completeRound,
  createTournamentRound,
  createNextTournamentRound,
  deleteGroupMatch,
  deleteRoundGroup,
  deleteTournamentRound,
  lockRoundAssignment,
  notifyMatchSchedule,
  updateRoundStatus,
  updateRoundGroup,
  updateGroupMatch,
} from './competitionService.js';


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

describe('calculateBalancedDistribution algorithm', () => {
  it('calculates balanced distribution for 100 teams with target group size 12', () => {
    const teams = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, name: `Team ${i + 1}`, rankAtQualification: i + 1 }));
    const result = calculateBalancedDistribution(teams, { mode: 'BY_SIZE', targetGroupSize: 12 });

    expect(result.groupCount).toBe(9);
    expect(result.groups.length).toBe(9);
    const totalAssigned = result.groups.reduce((sum, g) => sum + g.assignedTeams.length, 0);
    expect(totalAssigned).toBe(100);

    const sizes = result.groups.map((g) => g.assignedTeams.length);
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    expect(maxSize - minSize).toBeLessThanOrEqual(1);
    expect(sizes).toEqual([12, 11, 11, 11, 11, 11, 11, 11, 11]);
  });

  it('calculates balanced distribution for 25 teams in 3 groups', () => {
    const teams = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Team ${i + 1}` }));
    const result = calculateBalancedDistribution(teams, { mode: 'BY_GROUPS', groupCount: 3 });

    expect(result.groupCount).toBe(3);
    const sizes = result.groups.map((g) => g.assignedTeams.length);
    expect(sizes).toEqual([9, 8, 8]);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it('calculates balanced distribution for 120 teams in 10 groups', () => {
    const teams = Array.from({ length: 120 }, (_, i) => ({ id: i + 1, name: `Team ${i + 1}` }));
    const result = calculateBalancedDistribution(teams, { mode: 'BY_GROUPS', groupCount: 10 });

    expect(result.groupCount).toBe(10);
    const sizes = result.groups.map((g) => g.assignedTeams.length);
    expect(sizes).toEqual([12, 12, 12, 12, 12, 12, 12, 12, 12, 12]);
  });

  it('applies snake seeding and separates previous group rematches', () => {
    const teams = [
      { id: 1, name: 'Team A', rankAtQualification: 1, source_group_id: 101 },
      { id: 2, name: 'Team B', rankAtQualification: 2, source_group_id: 102 },
      { id: 3, name: 'Team C', rankAtQualification: 3, source_group_id: 101 },
      { id: 4, name: 'Team D', rankAtQualification: 4, source_group_id: 102 },
    ];
    const result = calculateBalancedDistribution(teams, { mode: 'BY_GROUPS', groupCount: 2, seedingEnabled: true, avoidRematch: true });

    expect(result.groupCount).toBe(2);
    // Team A and Team C (both from 101) should be in separate groups
    const g1TeamIds = result.groups[0].assignedTeams.map((t) => t.id);
    const g2TeamIds = result.groups[1].assignedTeams.map((t) => t.id);

    expect(g1TeamIds.includes(1)).not.toBe(g1TeamIds.includes(3));
    expect(g2TeamIds.includes(2)).not.toBe(g2TeamIds.includes(4));
  });
});

describe('autoAssignRoundGroups & bulkMove & lockRoundAssignment workflow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects autoAssign if round is locked', async () => {
    repository.getRoundContext.mockResolvedValue({ id: 1, organizer_id: 8, status: 'NOT_STARTED', is_locked: true, tournament_status: 'LIVE' });
    await expect(autoAssignRoundGroups(1, { groupCount: 4 }, 8)).rejects.toMatchObject({ status: 409 });
  });

  it('rejects bulkMove if round is locked', async () => {
    repository.getRoundContext.mockResolvedValue({ id: 1, organizer_id: 8, status: 'NOT_STARTED', is_locked: true, tournament_status: 'LIVE' });
    await expect(bulkMoveRoundTeams(1, { teamIds: [1, 2], targetGroupId: 3 }, 8)).rejects.toMatchObject({ status: 409 });
  });

  it('rejects lock if unassigned eligible teams remain', async () => {
    repository.getRoundContext.mockResolvedValue({ id: 1, organizer_id: 8, status: 'NOT_STARTED', is_locked: false, tournament_status: 'LIVE' });
    repository.lockRoundAssignment.mockRejectedValue(
      Object.assign(new Error('Cannot lock: 1 eligible teams remain unassigned'), { code: 'UNASSIGNED_TEAMS' })
    );

    await expect(lockRoundAssignment(1, 8)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('Cannot lock: 1 eligible teams remain unassigned'),
    });
  });

  it('successfully locks round when all eligible teams are assigned without duplicates', async () => {
    repository.getRoundContext.mockResolvedValue({ id: 1, organizer_id: 8, tournament_id: 5, round_number: 1, status: 'NOT_STARTED', is_locked: false, tournament_status: 'LIVE' });
    repository.lockRoundAssignment.mockResolvedValue({ id: 1, round_number: 1, name: 'Round 1', status: 'NOT_STARTED', is_locked: true, assignment_status: 'LOCKED' });
    repository.findRound.mockResolvedValue({ id: 1, round_number: 1, name: 'Round 1', status: 'NOT_STARTED', is_locked: true, assignment_status: 'LOCKED' });
    repository.getRoundAffectedPlayers.mockResolvedValue([{ user_id: 101, team_name: 'Team 1', group_name: 'Group A', round_number: 1 }]);

    const result = await lockRoundAssignment(1, 8);
    expect(result.assignmentStatus).toBe('LOCKED');
    expect(repository.lockRoundAssignment).toHaveBeenCalledWith(1);
  });
});

describe('match deletion & group deletion & notifications', () => {
  beforeEach(() => vi.clearAllMocks());

    it('rejects match deletion if tournament is completed', async () => {
      repository.getMatchContext.mockResolvedValue({ id: 10, organizer_id: 8, group_id: 2, tournament_status: 'COMPLETED' });
      await expect(deleteGroupMatch(10, 8)).rejects.toMatchObject({ status: 409 });
    });

    it('rejects match deletion if results are recorded', async () => {
      repository.getMatchContext.mockResolvedValue({ id: 10, organizer_id: 8, group_id: 2, tournament_status: 'LIVE' });
      repository.countMatchResults.mockResolvedValue(3);
      await expect(deleteGroupMatch(10, 8)).rejects.toMatchObject({ status: 409 });
    });

    it('successfully deletes match when no results exist', async () => {
      repository.getMatchContext.mockResolvedValue({ id: 10, organizer_id: 8, group_id: 2, tournament_status: 'LIVE' });
      repository.countMatchResults.mockResolvedValue(0);
      repository.deleteMatch.mockResolvedValue();

      const res = await deleteGroupMatch(10, 8);
      expect(res.success).toBe(true);
      expect(repository.deleteMatch).toHaveBeenCalledWith(10);
    });

    it('rejects group deletion if group has recorded match results', async () => {
      repository.getGroupContext.mockResolvedValue({ id: 2, organizer_id: 8, round_id: 1, tournament_status: 'LIVE' });
      repository.countGroupResults.mockResolvedValue(1);
      await expect(deleteRoundGroup(2, 8)).rejects.toMatchObject({ status: 409 });
    });

    it('rejects group deletion if group has finalized qualifications', async () => {
      repository.getGroupContext.mockResolvedValue({ id: 2, organizer_id: 8, round_id: 1, tournament_status: 'LIVE' });
      repository.countGroupResults.mockResolvedValue(0);
      repository.countGroupQualifications.mockResolvedValue(2);
      await expect(deleteRoundGroup(2, 8)).rejects.toMatchObject({ status: 409 });
    });

    it('rejects round deletion if tournament is completed', async () => {
      repository.getRoundContext.mockResolvedValue({ id: 1, organizer_id: 8, tournament_status: 'COMPLETED' });
      await expect(deleteTournamentRound(1, 8)).rejects.toMatchObject({ status: 409 });
    });

    it('rejects round deletion if recorded match results exist', async () => {
      repository.getRoundContext.mockResolvedValue({ id: 1, organizer_id: 8, tournament_status: 'LIVE' });
      repository.countRoundResults.mockResolvedValue(4);
      await expect(deleteTournamentRound(1, 8)).rejects.toMatchObject({ status: 409 });
    });

    it('rejects round deletion if qualifications are finalized', async () => {
      repository.getRoundContext.mockResolvedValue({ id: 1, organizer_id: 8, tournament_status: 'LIVE' });
      repository.countRoundResults.mockResolvedValue(0);
      repository.countRoundQualifications.mockResolvedValue(6);
      await expect(deleteTournamentRound(1, 8)).rejects.toMatchObject({ status: 409 });
    });

    it('successfully deletes round when safe', async () => {
      repository.getRoundContext.mockResolvedValue({ id: 1, organizer_id: 8, tournament_id: 5, tournament_status: 'LIVE' });
      repository.countRoundResults.mockResolvedValue(0);
      repository.countRoundQualifications.mockResolvedValue(0);
      repository.deleteRound.mockResolvedValue();

      const res = await deleteTournamentRound(1, 8);
      expect(res.success).toBe(true);
      expect(repository.deleteRound).toHaveBeenCalledWith(1);
    });
  });

