import { errorResponses } from '../errors/AppError.js';
import * as repository from '../repositories/competitionRepository.js';
import * as commRepo from '../repositories/communicationRepository.js';
import { countRoundQualifications } from './resultsService.js';
import { emitRealtime, realtimeEvents, realtimeRooms } from '../utils/realtimeHub.js';

const roundTransitions = { NOT_STARTED: ['IN_PROGRESS'], IN_PROGRESS: ['COMPLETED'] };
const groupTransitions = { NOT_STARTED: ['IN_PROGRESS'], IN_PROGRESS: ['COMPLETED'] };
const matchTransitions = { SCHEDULED: ['LIVE'], LIVE: ['COMPLETED'] };
const owner = (context, organizerId) => { if (!context || context.organizer_id !== organizerId) throw errorResponses.notFound('Competition resource not found'); };
const liveTournament = (context) => { if (context.tournament_status !== 'LIVE') throw errorResponses.conflict('Tournament must be LIVE for competition operations'); };
function transition(current, next, map, label) { if (next !== current && !map[current]?.includes(next)) throw errorResponses.conflict(`Invalid ${label} transition from ${current} to ${next}`); }
function mapError(error) {
  if (['TEAM_NOT_VERIFIED', 'TEAM_ALREADY_ASSIGNED', 'TEAM_NOT_QUALIFIED', 'GROUP_CAPACITY', 'ROUND_LOCKED', 'ROUND_ACTIVE', 'ROUND_COMPLETED', 'ALREADY_LOCKED', 'UNASSIGNED_TEAMS', 'INELIGIBLE_TEAMS', 'DUPLICATE_ASSIGNMENT', 'INVALID_TARGET_GROUP', 'TEAM_NOT_ASSIGNED', 'NEXT_ROUND_STARTED'].includes(error.code)) {
    throw errorResponses.conflict(error.message);
  }
  throw error;
}

function getGroupName(index) {
  let name = '';
  let num = index;
  while (num >= 0) {
    name = String.fromCharCode(65 + (num % 26)) + name;
    num = Math.floor(num / 26) - 1;
  }
  return `Group ${name}`;
}

export function calculateBalancedDistribution(eligibleTeams, options = {}) {
  const N = eligibleTeams.length;
  if (N === 0) {
    throw errorResponses.validation({ teams: 'No eligible teams available for assignment' });
  }

  let K = 1;
  if (options.mode === 'BY_SIZE' || (options.targetGroupSize && !options.groupCount)) {
    const targetSize = Math.max(1, Number(options.targetGroupSize) || 12);
    K = Math.max(1, Math.ceil(N / targetSize));
  } else {
    K = Math.max(1, Math.min(N, Number(options.groupCount) || 1));
  }

  // Base size and remainder for difference at most 1
  const baseSize = Math.floor(N / K);
  const remainder = N % K;

  const groupConfigs = [];
  for (let i = 0; i < K; i++) {
    const targetCap = i < remainder ? baseSize + 1 : baseSize;
    groupConfigs.push({
      key: `group_${i}`,
      name: getGroupName(i),
      groupSize: targetCap,
    });
  }

  // Copy teams for distribution
  const teamsToDistribute = [...eligibleTeams];

  // If seeding is enabled, sort by seed/rank/name
  const seeding = options.seedingEnabled !== false;
  if (seeding) {
    teamsToDistribute.sort((a, b) => {
      const rankA = a.rank_at_qualification ?? a.rankAtQualification ?? 9999;
      const rankB = b.rank_at_qualification ?? b.rankAtQualification ?? 9999;
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name);
    });
  }

  const avoidRematch = options.avoidRematch !== false;
  const assignments = [];
  const groupAssignedCounts = new Array(K).fill(0);
  const groupSourceMap = Array.from({ length: K }, () => new Map());

  // Assign teams using snake draft + source group diversification
  for (let tIdx = 0; tIdx < teamsToDistribute.length; tIdx++) {
    const team = teamsToDistribute[tIdx];
    const sourceGroup = team.source_group_id || team.sourceGroupId || null;

    // Find all groups that still have open capacity
    const availableGroupIndices = [];
    for (let g = 0; g < K; g++) {
      if (groupAssignedCounts[g] < groupConfigs[g].groupSize) {
        availableGroupIndices.push(g);
      }
    }

    let chosenGroupIdx = availableGroupIndices[0];

    if (avoidRematch && sourceGroup && availableGroupIndices.length > 1) {
      // Find candidate groups with the fewest teams from the same sourceGroup
      let minSourceCount = Infinity;
      const bestCandidates = [];

      for (const g of availableGroupIndices) {
        const count = groupSourceMap[g].get(sourceGroup) || 0;
        if (count < minSourceCount) {
          minSourceCount = count;
          bestCandidates.length = 0;
          bestCandidates.push(g);
        } else if (count === minSourceCount) {
          bestCandidates.push(g);
        }
      }

      // Pick snake preference among best candidates
      const roundNum = Math.floor(tIdx / K);
      const isReverse = roundNum % 2 === 1;
      const snakePreferredOrder = isReverse
        ? [...bestCandidates].reverse()
        : bestCandidates;

      chosenGroupIdx = snakePreferredOrder[0];
    } else if (availableGroupIndices.length > 1) {
      // Standard snake drafting order
      const roundNum = Math.floor(tIdx / K);
      const isReverse = roundNum % 2 === 1;
      const slotInRound = tIdx % K;
      const preferred = isReverse ? K - 1 - slotInRound : slotInRound;

      if (availableGroupIndices.includes(preferred)) {
        chosenGroupIdx = preferred;
      } else {
        chosenGroupIdx = availableGroupIndices[0];
      }
    }

    // Assign to chosen group
    groupAssignedCounts[chosenGroupIdx]++;
    if (sourceGroup) {
      groupSourceMap[chosenGroupIdx].set(
        sourceGroup,
        (groupSourceMap[chosenGroupIdx].get(sourceGroup) || 0) + 1
      );
    }

    assignments.push({
      groupKey: groupConfigs[chosenGroupIdx].key,
      groupIdx: chosenGroupIdx,
      groupName: groupConfigs[chosenGroupIdx].name,
      teamId: team.id,
      teamName: team.name,
    });
  }

  const groups = groupConfigs.map((cfg, idx) => ({
    ...cfg,
    assignedTeams: assignments
      .filter((a) => a.groupIdx === idx)
      .map((a) => ({ id: a.teamId, name: a.teamName })),
  }));

  return { groupCount: groupConfigs.length, groups, groupConfigs, assignments };
}

function serializeMatch(row) { return row && { id: row.id, groupId: row.group_id, matchNumber: row.match_number, name: row.name, status: row.status, scheduledAt: row.scheduled_at, startedAt: row.started_at, completedAt: row.completed_at, createdAt: row.created_at, updatedAt: row.updated_at }; }
function serializeGroup(row) { return row && { id: row.id, roundId: row.round_id, name: row.name, status: row.status, groupSize: row.group_size, roomId: row.room_id, roomPassword: row.room_password, startedAt: row.started_at, completedAt: row.completed_at, createdAt: row.created_at, updatedAt: row.updated_at, teams: (row.teams || []).map((team) => ({ id: team.id, name: team.name, assignedAt: team.assigned_at })), matches: (row.matches || []).map(serializeMatch) }; }
function serializeRound(row) { return row && { id: row.id, tournamentId: row.tournament_id, roundNumber: row.round_number, name: row.name, status: row.status, assignmentStatus: row.assignment_status || 'DRAFT', isLocked: Boolean(row.is_locked), qualificationsFinalizedAt: row.qualifications_finalized_at || null, startedAt: row.started_at, completedAt: row.completed_at, createdAt: row.created_at, updatedAt: row.updated_at }; }

export async function listTournamentRounds(tournamentId, organizerId) { const tournament = await repository.getTournamentContext(tournamentId); owner(tournament, organizerId); return (await repository.listRounds(tournamentId)).map(serializeRound); }
export async function getRound(roundId, organizerId) { const context = await repository.getRoundContext(roundId); owner(context, organizerId); return serializeRound(await repository.findRound(roundId)); }
export async function createTournamentRound(tournamentId, input, organizerId) { const tournament = await repository.getTournamentContext(tournamentId); owner(tournament, organizerId); liveTournament({ tournament_status: tournament.status }); const rounds = await repository.listRounds(tournamentId); const previous = rounds.at(-1); const expectedNumber = (previous?.round_number || 0) + 1; if (Number(input.roundNumber) !== expectedNumber) throw errorResponses.conflict(`The next round must be numbered ${expectedNumber}`); if (previous && previous.status !== 'COMPLETED') throw errorResponses.conflict('The previous round must be completed before creating the next round'); return serializeRound(await repository.createRound(tournamentId, input)); }
export async function completeRound(roundId, organizerId) { const context = await repository.getRoundContext(roundId); owner(context, organizerId); transition(context.status, 'COMPLETED', roundTransitions, 'round'); if (await repository.countIncompleteGroups(roundId)) throw errorResponses.conflict('Every group must be completed before the round'); if (!(await countRoundQualifications(roundId))) throw errorResponses.conflict('At least one qualifying team must be selected before the round'); return serializeRound(await repository.updateRound(roundId, 'COMPLETED')); }
export async function updateRoundStatus(roundId, status, organizerId) { const context = await repository.getRoundContext(roundId); owner(context, organizerId); liveTournament(context); transition(context.status, status, roundTransitions, 'round'); return serializeRound(await repository.updateRound(roundId, status)); }

export async function listRoundGroups(roundId, organizerId) { const context = await repository.getRoundContext(roundId); owner(context, organizerId); return (await repository.listGroups(roundId)).map(serializeGroup); }
export async function listPlayerTournamentGroups(tournamentId, userId) { const context = await repository.getTournamentContext(tournamentId); if (!context || (context.organizer_id !== userId && !(await repository.isPlayerAssignedToTournament(tournamentId, userId)))) throw errorResponses.notFound('Tournament not found'); return (await repository.listPlayerTournamentGroups(tournamentId, userId)).map(serializeGroup); }
export async function listEligibleRoundTeams(roundId, organizerId) { const context = await repository.getRoundContext(roundId); owner(context, organizerId); return repository.listEligibleTeams(roundId); }
export async function getGroup(groupId, userId) { const context = await repository.getGroupContext(groupId); if (!context || (context.organizer_id !== userId && !(await repository.isPlayerAssignedToGroup(groupId, userId)))) throw errorResponses.notFound('Group not found'); return serializeGroup(await repository.findGroup(groupId)); }
export async function createRoundGroup(roundId, input, organizerId) { const context = await repository.getRoundContext(roundId); owner(context, organizerId); liveTournament(context); if (context.status === 'COMPLETED') throw errorResponses.conflict('Completed rounds are read-only'); return serializeGroup(await repository.createGroup(roundId, input)); }
export async function updateRoundGroup(groupId, input, organizerId) { const context = await repository.getGroupContext(groupId); owner(context, organizerId); liveTournament(context); if (context.status === 'COMPLETED' && input.status !== 'COMPLETED') throw errorResponses.conflict('Completed groups are read-only'); if (input.status) { transition(context.status, input.status, groupTransitions, 'group'); if (input.status === 'COMPLETED' && await repository.countIncompleteMatches(groupId)) throw errorResponses.conflict('Every match must be completed before the group'); } return serializeGroup(await repository.updateGroup(groupId, input)); }
export async function assignVerifiedTeam(groupId, teamId, organizerId) { const context = await repository.getGroupContext(groupId); owner(context, organizerId); liveTournament(context); if (context.status === 'COMPLETED') throw errorResponses.conflict('Completed groups are read-only'); try { return serializeGroup(await repository.assignTeam(groupId, teamId)); } catch (error) { return mapError(error); } }
export async function removeAssignedTeam(groupId, teamId, organizerId) { const context = await repository.getGroupContext(groupId); owner(context, organizerId); if (context.status === 'COMPLETED') throw errorResponses.conflict('Completed groups are read-only'); try { return serializeGroup(await repository.removeTeam(groupId, teamId)); } catch (error) { return mapError(error); } }

export async function autoAssignRoundGroups(roundId, input, organizerId) {
  const context = await repository.getRoundContext(roundId);
  owner(context, organizerId);
  liveTournament(context);
  if (context.is_locked || context.assignment_status === 'LOCKED') {
    throw errorResponses.conflict('Group assignment is locked and cannot be regenerated');
  }
  if (context.status === 'COMPLETED' || context.status === 'IN_PROGRESS') {
    throw errorResponses.conflict('Cannot regenerate groups for an active or completed round');
  }

  const eligibleTeams = await repository.listEligibleTeams(roundId);
  if (!eligibleTeams.length) {
    throw errorResponses.conflict('No eligible teams found for this round');
  }

  const { groupConfigs, assignments } = calculateBalancedDistribution(eligibleTeams, input);
  try {
    const createdGroups = await repository.generateRoundGroupsAndAssignments(roundId, groupConfigs, assignments);
    const updatedRound = await repository.findRound(roundId);
    return {
      round: serializeRound(updatedRound),
      totalEligible: eligibleTeams.length,
      totalGroups: createdGroups.length,
      groups: createdGroups.map(serializeGroup),
      unassignedCount: 0,
      duplicateCount: 0,
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function bulkMoveRoundTeams(roundId, input, organizerId) {
  const context = await repository.getRoundContext(roundId);
  owner(context, organizerId);
  liveTournament(context);
  if (context.is_locked || context.assignment_status === 'LOCKED') {
    throw errorResponses.conflict('Group assignment is locked and cannot be modified');
  }
  if (!Array.isArray(input.teamIds) || input.teamIds.length === 0) {
    throw errorResponses.validation({ teamIds: 'At least one team must be selected' });
  }
  if (!input.targetGroupId) {
    throw errorResponses.validation({ targetGroupId: 'Target group is required' });
  }

  try {
    const groups = await repository.bulkMoveTeams(roundId, input.teamIds, input.targetGroupId);
    return { groups: groups.map(serializeGroup) };
  } catch (error) {
    return mapError(error);
  }
}

export async function lockRoundAssignment(roundId, organizerId) {
  const context = await repository.getRoundContext(roundId);
  owner(context, organizerId);
  liveTournament(context);
  if (context.is_locked || context.assignment_status === 'LOCKED') {
    throw errorResponses.conflict('Group assignment is already locked');
  }

  try {
    const lockedRound = (await repository.lockRoundAssignment(roundId)) || (await repository.findRound(roundId));
    
    // Notify affected players and send realtime event
    const affectedPlayers = (await repository.getRoundAffectedPlayers(roundId)) || [];
    const playerUserIds = [...new Set(affectedPlayers.map((p) => p.user_id))];
    
    if (playerUserIds.length > 0) {
      await commRepo.createNotifications(
        playerUserIds,
        context.tournament_id,
        'GROUP_ASSIGNED',
        `Your team has been assigned to Round ${context.round_number} group stage.`
      );
      for (const player of affectedPlayers) {
        emitRealtime(realtimeRooms.user(player.user_id), realtimeEvents.notification, {
          type: 'GROUP_ASSIGNED',
          message: `Your team "${player.team_name}" has been assigned to ${player.group_name} in Round ${player.round_number}.`,
        });
      }
    }

    emitRealtime(realtimeRooms.tournament(context.tournament_id), realtimeEvents.groupAssignmentLocked, {
      roundId: Number(roundId),
      roundNumber: context.round_number,
    });

    return serializeRound(lockedRound);
  } catch (error) {
    return mapError(error);
  }
}

export async function createNextTournamentRound(tournamentId, input, organizerId) {
  const tournament = await repository.getTournamentContext(tournamentId);
  owner(tournament, organizerId);
  liveTournament({ tournament_status: tournament.status });

  const rounds = await repository.listRounds(tournamentId);
  if (!rounds.length) {
    throw errorResponses.conflict('Round 1 must be created before next rounds');
  }

  const previous = rounds[rounds.length - 1];
  const expectedNumber = Number(previous.round_number) + 1;

  if (previous.status !== 'COMPLETED' && !previous.qualifications_finalized_at) {
    throw errorResponses.conflict('Previous round qualification must be finalized before creating the next round');
  }

  // Prevent duplicate next round
  const existingNext = await repository.findRoundByNumber(tournamentId, expectedNumber);
  if (existingNext) {
    throw errorResponses.conflict(`Round ${expectedNumber} already exists`);
  }

  const roundName = input.name ? input.name.trim() : `Round ${expectedNumber}`;
  const createdRound = await repository.createRound(tournamentId, {
    roundNumber: expectedNumber,
    name: roundName,
  });

  // If auto-group configuration parameters are provided, automatically generate groups
  let autoAssignResult = null;
  if (input.groupCount || input.targetGroupSize || input.autoAssign) {
    try {
      autoAssignResult = await autoAssignRoundGroups(createdRound.id, input, organizerId);
    } catch (e) {
      // Auto-assign is optional; if not feasible, round is still created
    }
  }

  emitRealtime(realtimeRooms.tournament(tournamentId), realtimeEvents.nextRoundCreated, {
    roundId: createdRound.id,
    roundNumber: expectedNumber,
  });

  return {
    round: serializeRound(createdRound),
    autoAssign: autoAssignResult,
  };
}

export async function listGroupMatches(groupId, userId) { const context = await repository.getGroupContext(groupId); if (!context || (context.organizer_id !== userId && !(await repository.isPlayerAssignedToGroup(groupId, userId)))) throw errorResponses.notFound('Group not found'); return (await repository.listMatches(groupId)).map(serializeMatch); }
export async function getMatch(matchId, userId) { const context = await repository.getMatchContext(matchId); if (!context || (context.organizer_id !== userId && !(await repository.isPlayerAssignedToGroup(context.group_id, userId)))) throw errorResponses.notFound('Match not found'); return serializeMatch(await repository.findMatch(matchId)); }
export async function createGroupMatch(groupId, input, organizerId) { const context = await repository.getGroupContext(groupId); owner(context, organizerId); liveTournament(context); if (context.status === 'COMPLETED') throw errorResponses.conflict('Completed groups are read-only'); return serializeMatch(await repository.createMatch(groupId, input)); }
export async function updateGroupMatch(matchId, input, organizerId) { const context = await repository.getMatchContext(matchId); owner(context, organizerId); liveTournament(context); transition(context.status, input.status || context.status, matchTransitions, 'match'); if (context.status === 'COMPLETED' && input.status !== 'COMPLETED') throw errorResponses.conflict('Completed matches are read-only'); return serializeMatch(await repository.updateMatch(matchId, input)); }
export async function completeMatch(matchId, organizerId) { return updateGroupMatch(matchId, { status: 'COMPLETED' }, organizerId); }

