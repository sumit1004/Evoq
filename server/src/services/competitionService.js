import { errorResponses } from '../errors/AppError.js';
import * as repository from '../repositories/competitionRepository.js';
import * as commRepo from '../repositories/communicationRepository.js';
import * as staffRepo from '../repositories/staffRepository.js';
import { countRoundQualifications } from './resultsService.js';
import { emitRealtime, realtimeEvents, realtimeRooms } from '../utils/realtimeHub.js';
import { assertTournamentAuthorization, PERMISSIONS } from './authorizationService.js';

const roundTransitions = { NOT_STARTED: ['IN_PROGRESS', 'COMPLETED'], IN_PROGRESS: ['COMPLETED'] };
const groupTransitions = { NOT_STARTED: ['IN_PROGRESS', 'COMPLETED'], IN_PROGRESS: ['COMPLETED'] };
const matchTransitions = { SCHEDULED: ['LIVE', 'COMPLETED'], LIVE: ['COMPLETED'] };

async function assertAccess(context, userId, { permission = null, isWrite = false, groupId = null } = {}) {
  if (!context) throw errorResponses.notFound('Competition resource not found');
  if (context.organizer_id === userId) {
    return { isOwner: true, isStaff: true, permissions: new Set(Object.values(PERMISSIONS)) };
  }
  const tournamentId = context.tournament_id || context.id;
  const targetGroupId = groupId || context.group_id || null;
  return assertTournamentAuthorization(tournamentId, userId, {
    permission,
    isWrite,
    groupId: targetGroupId,
  });
}

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

function serializeMatch(row) {
  return row && {
    id: row.id,
    groupId: row.group_id,
    matchNumber: row.match_number,
    name: row.name,
    status: row.status,
    roomId: row.room_id || null,
    roomPassword: row.room_password || null,
    scheduledAt: row.scheduled_at || null,
    checkInAt: row.check_in_at || null,
    lobbyOpenAt: row.lobby_open_at || null,
    instructions: row.instructions || null,
    startedAt: row.started_at || null,
    completedAt: row.completed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeGroup(row) {
  return row && {
    id: row.id,
    roundId: row.round_id,
    name: row.name,
    status: row.status,
    groupSize: row.group_size,
    roomId: row.room_id,
    roomPassword: row.room_password,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    teams: (row.teams || []).map((team) => ({ id: team.id, name: team.name, assignedAt: team.assigned_at })),
    matches: (row.matches || []).map(serializeMatch),
  };
}

function serializeRound(row) {
  return row && {
    id: row.id,
    tournamentId: row.tournament_id,
    roundNumber: row.round_number,
    name: row.name,
    status: row.status,
    assignmentStatus: row.assignment_status || 'DRAFT',
    isLocked: Boolean(row.is_locked),
    qualificationsFinalizedAt: row.qualifications_finalized_at || null,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listTournamentRounds(tournamentId, userId) {
  const tournament = await repository.getTournamentContext(tournamentId);
  await assertAccess(tournament, userId, { permission: PERMISSIONS.VIEW_ROUNDS });
  const rounds = await repository.listRounds(tournamentId);
  return Promise.all(
    rounds.map(async (r) => {
      const stats = await repository.getRoundStats(r.id);
      return { ...serializeRound(r), stats };
    })
  );
}

export async function getRound(roundId, userId) {
  const context = await repository.getRoundContext(roundId);
  await assertAccess(context, userId, { permission: PERMISSIONS.VIEW_ROUNDS });
  const round = await repository.findRound(roundId);
  const stats = await repository.getRoundStats(roundId);
  const groups = await repository.listGroups(roundId);
  return {
    ...serializeRound(round),
    stats,
    tournamentName: context.tournament_name,
    tournamentStatus: context.tournament_status,
    groups: groups.map(serializeGroup),
  };
}

export async function createTournamentRound(tournamentId, input, userId) {
  const tournament = await repository.getTournamentContext(tournamentId);
  await assertAccess(tournament, userId, { permission: PERMISSIONS.CREATE_ROUND, isWrite: true });
  liveTournament({ tournament_status: tournament.status });
  const rounds = await repository.listRounds(tournamentId);
  const previous = rounds.at(-1);
  const expectedNumber = (previous?.round_number || 0) + 1;
  if (Number(input.roundNumber) !== expectedNumber) throw errorResponses.conflict(`The next round must be numbered ${expectedNumber}`);
  if (previous && previous.status !== 'COMPLETED') throw errorResponses.conflict('The previous round must be completed before creating the next round');
  const created = await repository.createRound(tournamentId, input);
  await staffRepo.insertAuditLog({
    tournamentId: Number(tournamentId),
    userId,
    actorId: userId,
    action: 'ROUND_CREATED',
    entityType: 'ROUND',
    entityId: created.id,
    metadata: { roundNumber: input.roundNumber, name: input.name },
  });
  return serializeRound(created);
}

export async function completeRound(roundId, userId) {
  const context = await repository.getRoundContext(roundId);
  await assertAccess(context, userId, { permission: PERMISSIONS.COMPLETE_ROUND, isWrite: true });
  transition(context.status, 'COMPLETED', roundTransitions, 'round');
  if (await repository.countIncompleteGroups(roundId)) throw errorResponses.conflict('Every group must be completed before the round');
  if (!(await countRoundQualifications(roundId))) throw errorResponses.conflict('At least one qualifying team must be selected before the round');
  const updated = await repository.updateRound(roundId, 'COMPLETED');
  await staffRepo.insertAuditLog({
    tournamentId: context.tournament_id,
    userId,
    actorId: userId,
    action: 'ROUND_COMPLETED',
    entityType: 'ROUND',
    entityId: Number(roundId),
    metadata: { roundNumber: context.round_number },
  });
  return serializeRound(updated);
}

export async function updateRoundStatus(roundId, status, userId) {
  const context = await repository.getRoundContext(roundId);
  await assertAccess(context, userId, { permission: PERMISSIONS.EDIT_ROUND, isWrite: true });
  liveTournament(context);
  transition(context.status, status, roundTransitions, 'round');
  return serializeRound(await repository.updateRound(roundId, status));
}


export async function listRoundGroups(roundId, userId) {
  const context = await repository.getRoundContext(roundId);
  await assertAccess(context, userId, { permission: PERMISSIONS.VIEW_GROUPS });
  return (await repository.listGroups(roundId)).map(serializeGroup);
}

export async function listPlayerTournamentGroups(tournamentId, userId) {
  const context = await repository.getTournamentContext(tournamentId);
  if (!context) throw errorResponses.notFound('Tournament not found');
  let allowed = context.organizer_id === userId;
  if (!allowed) {
    allowed = await repository.isPlayerAssignedToTournament(tournamentId, userId);
  }
  if (!allowed) {
    try {
      const staffAuth = await assertTournamentAuthorization(tournamentId, userId, { permission: PERMISSIONS.VIEW_GROUPS });
      allowed = Boolean(staffAuth.isStaff);
    } catch {
      allowed = false;
    }
  }
  if (!allowed) throw errorResponses.notFound('Tournament not found');
  return (await repository.listPlayerTournamentGroups(tournamentId, userId)).map(serializeGroup);
}

export async function listEligibleRoundTeams(roundId, userId) {
  const context = await repository.getRoundContext(roundId);
  await assertAccess(context, userId, { permission: PERMISSIONS.ASSIGN_TEAMS });
  return repository.listEligibleTeams(roundId);
}

export async function getGroup(groupId, userId) {
  const context = await repository.getGroupContext(groupId);
  if (!context) throw errorResponses.notFound('Group not found');
  let allowed = context.organizer_id === userId;
  if (!allowed) {
    allowed = await repository.isPlayerAssignedToGroup(groupId, userId);
  }
  if (!allowed) {
    try {
      const staffAuth = await assertTournamentAuthorization(context.tournament_id, userId, {
        permission: PERMISSIONS.VIEW_GROUPS,
        groupId,
      });
      allowed = Boolean(staffAuth.isStaff);
    } catch {
      allowed = false;
    }
  }
  if (!allowed) throw errorResponses.notFound('Group not found');
  return serializeGroup(await repository.findGroup(groupId));
}

export async function createRoundGroup(roundId, input, userId) {
  const context = await repository.getRoundContext(roundId);
  await assertAccess(context, userId, { permission: PERMISSIONS.CREATE_GROUP, isWrite: true });
  liveTournament(context);
  if (context.status === 'COMPLETED') throw errorResponses.conflict('Completed rounds are read-only');
  const group = await repository.createGroup(roundId, input);
  await staffRepo.insertAuditLog({
    tournamentId: context.tournament_id,
    userId,
    actorId: userId,
    action: 'GROUP_CREATED',
    entityType: 'GROUP',
    entityId: group.id,
    metadata: { roundId, name: input.name, groupSize: input.groupSize },
  });
  return serializeGroup(group);
}

export async function updateRoundGroup(groupId, input, userId) {
  const context = await repository.getGroupContext(groupId);
  const requiredPerm = (input.room_id !== undefined || input.room_password !== undefined)
    ? PERMISSIONS.EDIT_ROOM
    : PERMISSIONS.EDIT_GROUP;
  await assertAccess(context, userId, { permission: requiredPerm, isWrite: true, groupId });
  liveTournament(context);
  if (context.status === 'COMPLETED' && input.status !== 'COMPLETED') throw errorResponses.conflict('Completed groups are read-only');
  if (input.status) {
    transition(context.status, input.status, groupTransitions, 'group');
    if (input.status === 'COMPLETED' && await repository.countIncompleteMatches(groupId)) throw errorResponses.conflict('Every match must be completed before the group');
  }
  const updated = await repository.updateGroup(groupId, input);
  await staffRepo.insertAuditLog({
    tournamentId: context.tournament_id,
    groupId: Number(groupId),
    userId,
    actorId: userId,
    action: input.room_id !== undefined || input.room_password !== undefined ? 'ROOM_UPDATED' : 'GROUP_UPDATED',
    entityType: 'GROUP',
    entityId: Number(groupId),
    metadata: input,
  });
  return serializeGroup(updated);
}

export async function assignVerifiedTeam(groupId, teamId, userId) {
  const context = await repository.getGroupContext(groupId);
  await assertAccess(context, userId, { permission: PERMISSIONS.ASSIGN_TEAMS, isWrite: true, groupId });
  liveTournament(context);
  if (context.status === 'COMPLETED') throw errorResponses.conflict('Completed groups are read-only');
  try {
    const res = await repository.assignTeam(groupId, teamId);
    await staffRepo.insertAuditLog({
      tournamentId: context.tournament_id,
      groupId: Number(groupId),
      userId,
      actorId: userId,
      action: 'TEAM_ASSIGNED',
      entityType: 'GROUP_TEAM',
      entityId: Number(teamId),
      metadata: { groupId, teamId },
    });
    return serializeGroup(res);
  } catch (error) {
    return mapError(error);
  }
}

export async function removeAssignedTeam(groupId, teamId, userId) {
  const context = await repository.getGroupContext(groupId);
  await assertAccess(context, userId, { permission: PERMISSIONS.REMOVE_TEAMS, isWrite: true, groupId });
  if (context.status === 'COMPLETED') throw errorResponses.conflict('Completed groups are read-only');
  try {
    const res = await repository.removeTeam(groupId, teamId);
    await staffRepo.insertAuditLog({
      tournamentId: context.tournament_id,
      groupId: Number(groupId),
      userId,
      actorId: userId,
      action: 'TEAM_REMOVED',
      entityType: 'GROUP_TEAM',
      entityId: Number(teamId),
      metadata: { groupId, teamId },
    });
    return serializeGroup(res);
  } catch (error) {
    return mapError(error);
  }
}

export async function autoAssignRoundGroups(roundId, input, userId) {
  const context = await repository.getRoundContext(roundId);
  await assertAccess(context, userId, { permission: PERMISSIONS.ASSIGN_TEAMS, isWrite: true });
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

export async function bulkMoveRoundTeams(roundId, input, userId) {
  const context = await repository.getRoundContext(roundId);
  await assertAccess(context, userId, { permission: PERMISSIONS.ASSIGN_TEAMS, isWrite: true });
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

export async function lockRoundAssignment(roundId, userId) {
  const context = await repository.getRoundContext(roundId);
  await assertAccess(context, userId, { permission: PERMISSIONS.ASSIGN_TEAMS, isWrite: true });
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

export async function createNextTournamentRound(tournamentId, input, userId) {
  const tournament = await repository.getTournamentContext(tournamentId);
  await assertAccess(tournament, userId, { permission: PERMISSIONS.CREATE_ROUND, isWrite: true });
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
      autoAssignResult = await autoAssignRoundGroups(createdRound.id, input, userId);
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

export async function listGroupMatches(groupId, userId) {
  const context = await repository.getGroupContext(groupId);
  if (!context) throw errorResponses.notFound('Group not found');
  let allowed = context.organizer_id === userId;
  if (!allowed) {
    allowed = await repository.isPlayerAssignedToGroup(groupId, userId);
  }
  if (!allowed) {
    try {
      const staffAuth = await assertTournamentAuthorization(context.tournament_id, userId, {
        permission: PERMISSIONS.VIEW_MATCHES,
        groupId,
      });
      allowed = Boolean(staffAuth.isStaff);
    } catch {
      allowed = false;
    }
  }
  if (!allowed) throw errorResponses.notFound('Group not found');
  return (await repository.listMatches(groupId)).map(serializeMatch);
}

export async function getMatch(matchId, userId) {
  const context = await repository.getMatchContext(matchId);
  if (!context) throw errorResponses.notFound('Match not found');
  let allowed = context.organizer_id === userId;
  if (!allowed) {
    allowed = await repository.isPlayerAssignedToGroup(context.group_id, userId);
  }
  if (!allowed) {
    try {
      const staffAuth = await assertTournamentAuthorization(context.tournament_id, userId, {
        permission: PERMISSIONS.VIEW_MATCHES,
        groupId: context.group_id,
      });
      allowed = Boolean(staffAuth.isStaff);
    } catch {
      allowed = false;
    }
  }
  if (!allowed) throw errorResponses.notFound('Match not found');
  const match = await repository.findMatch(matchId);
  return {
    ...serializeMatch(match),
    tournamentName: context.tournament_name,
    tournamentId: context.tournament_id,
    roundName: context.round_name,
    roundId: context.round_id,
    roundNumber: context.round_number,
    groupName: context.group_name,
    groupId: context.group_id,
  };
}

export async function createGroupMatch(groupId, input, userId) {
  const context = await repository.getGroupContext(groupId);
  await assertAccess(context, userId, { permission: PERMISSIONS.CREATE_MATCH, isWrite: true, groupId });
  liveTournament(context);
  if (context.status === 'COMPLETED') throw errorResponses.conflict('Completed groups are read-only');
  const match = await repository.createMatch(groupId, input);
  await staffRepo.insertAuditLog({
    tournamentId: context.tournament_id,
    groupId: Number(groupId),
    userId,
    actorId: userId,
    action: 'MATCH_CREATED',
    entityType: 'MATCH',
    entityId: match.id,
    metadata: { groupId, matchNumber: input.matchNumber, name: input.name },
  });
  emitRealtime(realtimeRooms.group(groupId), 'match_created', serializeMatch(match));
  return serializeMatch(match);
}

export async function updateGroupMatch(matchId, input, userId) {
  const context = await repository.getMatchContext(matchId);
  let requiredPerm = PERMISSIONS.EDIT_MATCH;
  if (input.status === 'LIVE') requiredPerm = PERMISSIONS.START_MATCH;
  else if (input.status === 'COMPLETED') requiredPerm = PERMISSIONS.COMPLETE_MATCH;
  else if (input.room_id !== undefined || input.room_password !== undefined) requiredPerm = PERMISSIONS.EDIT_ROOM;

  await assertAccess(context, userId, { permission: requiredPerm, isWrite: true, groupId: context.group_id });
  liveTournament(context);
  transition(context.status, input.status || context.status, matchTransitions, 'match');
  if (context.status === 'COMPLETED' && input.status !== 'COMPLETED') throw errorResponses.conflict('Completed matches are read-only');
  const match = await repository.updateMatch(matchId, input);
  await staffRepo.insertAuditLog({
    tournamentId: context.tournament_id,
    groupId: context.group_id,
    userId,
    actorId: userId,
    action: input.status === 'LIVE' ? 'MATCH_STARTED' : input.status === 'COMPLETED' ? 'MATCH_COMPLETED' : 'MATCH_UPDATED',
    entityType: 'MATCH',
    entityId: Number(matchId),
    metadata: input,
  });
  emitRealtime(realtimeRooms.group(context.group_id), 'match_update', serializeMatch(match));
  return serializeMatch(match);
}

export async function completeMatch(matchId, userId) {
  return updateGroupMatch(matchId, { status: 'COMPLETED' }, userId);
}

export async function deleteGroupMatch(matchId, userId) {
  const context = await repository.getMatchContext(matchId);
  await assertAccess(context, userId, { permission: PERMISSIONS.DELETE_MATCH, isWrite: true, groupId: context.group_id });
  if (context.tournament_status === 'COMPLETED') {
    throw errorResponses.conflict('Completed tournaments are read-only');
  }
  const resultCount = await repository.countMatchResults(matchId);
  if (resultCount > 0) {
    throw errorResponses.conflict(
      'This match contains recorded results. Delete is restricted. Remove or correct the results first.'
    );
  }
  await repository.deleteMatch(matchId);
  await staffRepo.insertAuditLog({
    tournamentId: context.tournament_id,
    groupId: context.group_id,
    userId,
    actorId: userId,
    action: 'MATCH_DELETED',
    entityType: 'MATCH',
    entityId: Number(matchId),
  });
  emitRealtime(realtimeRooms.group(context.group_id), 'match_deleted', { matchId: Number(matchId) });
  return { success: true, matchId: Number(matchId) };
}

export async function deleteRoundGroup(groupId, userId) {
  const context = await repository.getGroupContext(groupId);
  await assertAccess(context, userId, { permission: PERMISSIONS.DELETE_GROUP, isWrite: true, groupId });
  if (context.tournament_status === 'COMPLETED') {
    throw errorResponses.conflict('Completed tournaments are read-only');
  }
  const resultCount = await repository.countGroupResults(groupId);
  if (resultCount > 0) {
    throw errorResponses.conflict('Group contains completed match results and cannot be deleted.');
  }
  const qualCount = await repository.countGroupQualifications(groupId);
  if (qualCount > 0) {
    throw errorResponses.conflict('Group has qualified teams and cannot be deleted without resetting qualifications.');
  }
  await repository.deleteGroup(groupId);
  await staffRepo.insertAuditLog({
    tournamentId: context.tournament_id,
    groupId: Number(groupId),
    userId,
    actorId: userId,
    action: 'GROUP_DELETED',
    entityType: 'GROUP',
    entityId: Number(groupId),
  });
  emitRealtime(realtimeRooms.tournament(context.tournament_id), 'group_deleted', {
    groupId: Number(groupId),
    roundId: context.round_id,
  });
  return { success: true, groupId: Number(groupId) };
}

export async function deleteTournamentRound(roundId, userId) {
  const context = await repository.getRoundContext(roundId);
  await assertAccess(context, userId, { permission: PERMISSIONS.DELETE_GROUP, isWrite: true });
  if (context.tournament_status === 'COMPLETED') {
    throw errorResponses.conflict('Completed tournaments are read-only');
  }
  const resultCount = await repository.countRoundResults(roundId);
  if (resultCount > 0) {
    throw errorResponses.conflict('Round contains recorded match results and cannot be deleted.');
  }
  const qualCount = await repository.countRoundQualifications(roundId);
  if (qualCount > 0) {
    throw errorResponses.conflict('Round has finalized qualifications and cannot be deleted.');
  }
  await repository.deleteRound(roundId);
  await staffRepo.insertAuditLog({
    tournamentId: context.tournament_id,
    userId,
    actorId: userId,
    action: 'ROUND_DELETED',
    entityType: 'ROUND',
    entityId: Number(roundId),
  });
  emitRealtime(realtimeRooms.tournament(context.tournament_id), 'round_deleted', {
    roundId: Number(roundId),
    tournamentId: context.tournament_id,
  });
  return { success: true, roundId: Number(roundId) };
}

export async function notifyMatchSchedule(matchId, userId) {
  const context = await repository.getMatchContext(matchId);
  await assertAccess(context, userId, { permission: PERMISSIONS.EDIT_MATCH, isWrite: true, groupId: context.group_id });
  const affected = await repository.getMatchAffectedPlayers(matchId);
  const playerUserIds = [...new Set(affected.map((p) => p.user_id))];

  const match = await repository.findMatch(matchId);
  const timeString = match.scheduled_at
    ? new Date(match.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'TBD';

  let message = `Match Details: Round ${context.round_number} · ${context.group_name} · ${match.name} scheduled for ${timeString}.`;
  if (match.room_id) {
    message += ` Room ID: ${match.room_id}`;
  }
  if (match.room_password) {
    message += ` Password: ${match.room_password}`;
  }
  if (match.instructions) {
    message += ` Note: ${match.instructions}`;
  }

  if (playerUserIds.length > 0) {
    await commRepo.createNotifications(
      playerUserIds,
      context.tournament_id,
      'MATCH_SCHEDULE',
      message
    );
    for (const p of affected) {
      emitRealtime(realtimeRooms.user(p.user_id), realtimeEvents.notification, {
        type: 'MATCH_SCHEDULE',
        matchId: match.id,
        message,
      });
    }
  }

  emitRealtime(realtimeRooms.group(context.group_id), 'match_update', serializeMatch(match));

  return {
    success: true,
    recipientsCount: playerUserIds.length,
    match: serializeMatch(match),
  };
}

export async function getCompetitionSummary(tournamentId, userId) {
  const tournament = await repository.getTournamentContext(tournamentId);
  const auth = await assertAccess(tournament, userId, { permission: PERMISSIONS.VIEW_ROUNDS });

  const roundList = await repository.listRounds(tournamentId);
  const rounds = await Promise.all(
    roundList.map(async (r) => {
      const stats = await repository.getRoundStats(r.id);
      const groups = await repository.listGroups(r.id);
      return {
        ...serializeRound(r),
        stats,
        groups: groups.map(serializeGroup),
      };
    })
  );

  let currentRound = rounds.find((r) => r.status === 'IN_PROGRESS');
  if (!currentRound && rounds.length > 0) {
    currentRound = rounds.find((r) => r.status === 'NOT_STARTED') || rounds[rounds.length - 1];
  }

  let nextAction = {
    type: 'NO_ACTION',
    label: 'All Operations Up To Date',
    description: 'Competition operations are current.',
  };

  if (tournament.status === 'DRAFT') {
    nextAction = {
      type: 'OPEN_REGISTRATION',
      label: 'Open Tournament Registration',
      description: 'Registration is not yet open for players.',
    };
  } else if (tournament.status === 'REGISTRATION_OPEN') {
    nextAction = {
      type: 'REVIEW_REGISTRATIONS',
      label: 'Review Applications',
      description: 'Incoming team registrations await verification.',
    };
  } else if (tournament.status === 'REGISTRATION_CLOSED') {
    nextAction = {
      type: 'START_TOURNAMENT',
      label: 'Start Tournament (LIVE)',
      description: 'Registration closed. Start tournament to proceed with competition.',
    };
  } else if (tournament.status === 'COMPLETED') {
    nextAction = {
      type: 'VIEW_ARCHIVE',
      label: 'Tournament Completed',
      description: 'Tournament has been finalized. Operations are read-only.',
    };
  } else if (rounds.length === 0) {
    nextAction = {
      type: 'CREATE_ROUND_1',
      label: 'Create Round 1',
      description: 'Set up Round 1 to begin assigning competition groups.',
    };
  } else if (currentRound) {
    const roundGroups = currentRound.groups || [];
    const totalGroups = roundGroups.length;
    const totalAssignedTeams = roundGroups.reduce((acc, g) => acc + (g.teams?.length || 0), 0);
    const allMatches = roundGroups.flatMap((g) => g.matches || []);
    const totalMatches = allMatches.length;
    const completedMatches = allMatches.filter((m) => m.status === 'COMPLETED').length;
    const liveMatches = allMatches.filter((m) => m.status === 'LIVE').length;

    if (totalGroups === 0) {
      nextAction = {
        type: 'CREATE_GROUPS',
        label: 'Create Groups',
        description: `Round ${currentRound.roundNumber} has no groups created yet.`,
        roundId: currentRound.id,
      };
    } else if (totalAssignedTeams === 0) {
      nextAction = {
        type: 'ASSIGN_TEAMS',
        label: 'Assign Teams to Groups',
        description: 'Groups exist but no teams are assigned.',
        roundId: currentRound.id,
      };
    } else if (totalMatches === 0) {
      nextAction = {
        type: 'CREATE_MATCHES',
        label: 'Schedule Matches',
        description: 'Groups are ready. Create matches for teams to compete.',
        roundId: currentRound.id,
      };
    } else if (liveMatches > 0) {
      nextAction = {
        type: 'MONITOR_LIVE',
        label: 'Live Matches in Progress',
        description: `${liveMatches} match${liveMatches > 1 ? 'es are' : ' is'} currently live.`,
        roundId: currentRound.id,
      };
    } else if (completedMatches < totalMatches) {
      nextAction = {
        type: 'REVIEW_MATCH_RESULTS',
        label: 'Enter & Review Match Scores',
        description: `${completedMatches} of ${totalMatches} matches completed. Record remaining scores.`,
        roundId: currentRound.id,
      };
    } else if (!currentRound.qualificationsFinalizedAt) {
      nextAction = {
        type: 'SELECT_QUALIFIED_TEAMS',
        label: 'Finalize Qualifications',
        description: 'All matches completed. Select and confirm qualifying teams for next round.',
        roundId: currentRound.id,
      };
    } else {
      const roundIdx = rounds.findIndex((r) => r.id === currentRound.id);
      const hasNextRound = roundIdx >= 0 && roundIdx < rounds.length - 1;
      if (hasNextRound) {
        nextAction = {
          type: 'MANAGE_NEXT_ROUND',
          label: 'Proceed to Next Round',
          description: `Round ${rounds[roundIdx + 1].roundNumber} is ready for setup.`,
          roundId: rounds[roundIdx + 1].id,
        };
      } else if (currentRound.status === 'COMPLETED') {
        nextAction = {
          type: 'COMPLETE_TOURNAMENT',
          label: 'Finalize & Complete Tournament',
          description: 'All rounds finished. Generate permanent immutable final leaderboard archive.',
          roundId: currentRound.id,
        };
      } else {
        nextAction = {
          type: 'CREATE_NEXT_ROUND',
          label: 'Create Next Round',
          description: 'Advance qualified teams into the next competition round, or complete round.',
          roundId: currentRound.id,
        };
      }
    }
  }

  if (tournament.status === 'COMPLETED') {
    nextAction = {
      type: 'TOURNAMENT_COMPLETED',
      label: 'Tournament Completed',
      description: 'Official tournament standings and final leaderboard are permanently archived.',
    };
  }

  return {
    tournament: {
      id: tournament.id,
      name: tournament.name,
      status: tournament.status,
      organizerId: tournament.organizer_id,
    },
    currentRoundId: currentRound?.id || null,
    rounds,
    nextAction,
    permissions: Array.from(auth.permissions || []),
  };
}



