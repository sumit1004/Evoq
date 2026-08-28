import fs from 'node:fs/promises';
import { errorResponses } from '../errors/AppError.js';
import * as repository from '../repositories/resultsRepository.js';
import * as compRepo from '../repositories/competitionRepository.js';
import * as staffRepo from '../repositories/staffRepository.js';
import { emitRealtime, realtimeEvents, realtimeRooms } from '../utils/realtimeHub.js';
import { assertTournamentAuthorization, PERMISSIONS } from './authorizationService.js';

import * as scoringService from './scoringService.js';

function resultDto(row) { return { id: row.id, matchId: row.match_id, groupId: row.group_id, teamId: row.team_id, teamName: row.team_name, points: Number(row.points), kills: Number(row.kills), placement: row.placement, killPoints: row.kill_points !== null && row.kill_points !== undefined ? Number(row.kill_points) : null, positionPoints: row.position_points !== null && row.position_points !== undefined ? Number(row.position_points) : null, resultText: row.result_text, hasMedia: Boolean(row.media_path), uploadedBy: row.uploaded_by, createdAt: row.created_at, updatedAt: row.updated_at }; }
function leaderboardDto(row) {
  return {
    matchId: row.match_id,
    groupId: row.group_id,
    roundId: row.round_id,
    teamId: row.team_id,
    teamName: row.team_name,
    points: Number(row.points),
    kills: Number(row.kills),
    position: row.placement !== null && row.placement !== undefined ? Number(row.placement) : (row.position !== null && row.position !== undefined ? Number(row.position) : null),
    placement: row.placement !== null && row.placement !== undefined ? Number(row.placement) : null,
    rank: row.rank ? Number(row.rank) : undefined,
    matchesPlayed: row.matches_played ? Number(row.matches_played) : undefined
  };
}
function qualificationDto(row) { return { roundId: row.round_id, teamId: row.team_id, teamName: row.team_name, sourceGroupId: row.source_group_id, sourceGroupName: row.source_group_name, rankAtQualification: row.rank_at_qualification, selectedBy: row.selected_by, selectedAt: row.selected_at }; }

async function assertMatchAccess(matchId, userId, write = false) {
  const context = await repository.getMatchContext(matchId);
  if (!context) throw errorResponses.notFound('Match not found');
  if (context.tournament_status === 'COMPLETED' && write) throw errorResponses.conflict('Completed tournaments are read-only');
  if (context.organizer_id === userId) {
    return context;
  }
  if (write) {
    await assertTournamentAuthorization(context.tournament_id, userId, {
      permission: PERMISSIONS.ENTER_RESULTS,
      isWrite: true,
      groupId: context.group_id,
    });
    return context;
  }
  let allowed = false;
  if (await repository.isPlayerAssignedToGroup(context.group_id, userId)) {
    allowed = true;
  }
  if (!allowed) {
    try {
      const staffAuth = await assertTournamentAuthorization(context.tournament_id, userId, {
        permission: PERMISSIONS.VIEW_RESULTS,
        groupId: context.group_id,
      });
      allowed = Boolean(staffAuth.isStaff);
    } catch {
      allowed = false;
    }
  }
  if (!allowed) throw errorResponses.notFound('Match not found');
  return context;
}

async function assertScopedAccess(context, userId, playerAccess) {
  if (!context) throw errorResponses.notFound('Competition resource not found');
  if (context.organizer_id === userId) return;
  if (playerAccess && (await playerAccess(userId))) return;
  try {
    const tournamentId = context.tournament_id || context.id;
    const staffAuth = await assertTournamentAuthorization(tournamentId, userId, {
      permission: PERMISSIONS.VIEW_LEADERBOARD,
    });
    if (staffAuth.isStaff) return;
  } catch {
    // continue to notFound
  }
  throw errorResponses.notFound('Competition resource not found');
}
export async function getMatchContext(matchId) { return repository.getMatchContext(matchId); }

export async function listMatchResults(matchId, userId) { await assertMatchAccess(matchId, userId); return (await repository.listMatchResults(matchId)).map(resultDto); }
export async function createMatchResult(matchId, input, userId, uploadedFile) {
  const context = await assertMatchAccess(matchId, userId, true);
  if (context.status === 'COMPLETED') throw errorResponses.conflict('Completed matches cannot accept new results');
  const teamId = Number(input.teamId);
  if (!teamId || !(await repository.getTeamInMatchGroup(matchId, teamId))) {
    throw errorResponses.validation({ teamId: 'Team is not assigned to this competition group' });
  }

  const scoringConfig = await scoringService.getTournamentScoringConfig(context.tournament_id);
  const calculated = scoringService.calculateMatchTeamScore(scoringConfig, input);
  const resultText = input.resultText ? String(input.resultText).trim() : null;

  const existing = await repository.findResult(matchId, teamId);
  try {
    let resultId;
    if (existing) {
      await repository.updateResult({
        matchId,
        teamId,
        points: calculated.totalPoints,
        kills: calculated.kills,
        placement: calculated.placement,
        killPoints: calculated.killPoints,
        positionPoints: calculated.positionPoints,
        resultText,
        mediaPath: uploadedFile ? uploadedFile.filename : null,
        uploadedBy: userId,
      });
      resultId = existing.id;
    } else {
      resultId = await repository.insertResult({
        matchId,
        teamId,
        points: calculated.totalPoints,
        kills: calculated.kills,
        placement: calculated.placement,
        killPoints: calculated.killPoints,
        positionPoints: calculated.positionPoints,
        resultText,
        mediaPath: uploadedFile ? uploadedFile.filename : null,
        uploadedBy: userId,
      });
    }

    // Automatically recalculate leaderboard entries
    const allResults = await repository.listMatchResults(matchId);
    const entries = allResults.map((row, index) => ({
      teamId: row.team_id,
      points: Number(row.points),
      kills: Number(row.kills),
      rank: index + 1,
    }));
    await repository.replaceLeaderboard(matchId, entries);

    const savedRow = (await repository.listMatchResults(matchId)).find((item) => Number(item.team_id) === teamId);
    const dto = resultDto({ ...savedRow, id: resultId, group_id: context.group_id, uploaded_by: userId });

    // Emit realtime leaderboard update
    const updatedLeaderboard = (await repository.listMatchLeaderboard(matchId)).map(leaderboardDto);
    emitRealtime(realtimeRooms.tournament(context.tournament_id), realtimeEvents.leaderboardUpdate, {
      matchId,
      groupId: context.group_id,
      roundId: context.round_id,
      leaderboard: updatedLeaderboard,
    });
    emitRealtime(realtimeRooms.group(context.group_id), realtimeEvents.leaderboardUpdate, {
      matchId,
      groupId: context.group_id,
      roundId: context.round_id,
      leaderboard: updatedLeaderboard,
    });

    return dto;
  } catch (error) {
    if (uploadedFile) await fs.unlink(uploadedFile.path).catch(() => {});
    throw error;
  }
}


export async function recalculateMatchLeaderboard(matchId, userId) { await assertMatchAccess(matchId, userId, true); const entries = (await repository.listMatchResults(matchId)).map((row, index) => ({ teamId: row.team_id, points: Number(row.points), kills: Number(row.kills), rank: index + 1 })); await repository.replaceLeaderboard(matchId, entries); return (await repository.listMatchLeaderboard(matchId)).map(leaderboardDto); }
export async function getMatchLeaderboard(matchId, userId) { await assertMatchAccess(matchId, userId); return (await repository.listMatchLeaderboard(matchId)).map(leaderboardDto); }
export async function getGroupLeaderboard(groupId, userId) { const context = await repository.getGroupContext(groupId); await assertScopedAccess(context, userId, (playerId) => repository.isPlayerAssignedToGroup(groupId, playerId)); return (await repository.listGroupLeaderboard(groupId)).map((row, idx) => ({ ...leaderboardDto(row), rank: row.rank || idx + 1 })); }
export async function getRoundLeaderboard(roundId, userId) { const context = await repository.getRoundContext(roundId); await assertScopedAccess(context, userId, (playerId) => repository.isPlayerAssignedToRound(roundId, playerId)); return (await repository.listRoundLeaderboard(roundId)).map((row, idx) => ({ ...leaderboardDto(row), rank: row.rank || idx + 1 })); }
export async function getTournamentResults(tournamentId, userId) { const context = await repository.getTournamentContext(tournamentId); await assertScopedAccess(context, userId, (playerId) => repository.isPlayerAssignedToTournament(tournamentId, playerId)); return (await repository.listTournamentResults(tournamentId)).map((row) => ({ matchId: row.match_id, matchName: row.match_name, groupId: row.group_id, groupName: row.group_name, roundId: row.round_id, roundName: row.round_name, teamId: row.team_id, teamName: row.team_name, points: Number(row.points), kills: Number(row.kills), placement: row.placement, resultText: row.result_text, createdAt: row.created_at })); }
export async function getTournamentLeaderboard(tournamentId, userId) { const context = await repository.getTournamentContext(tournamentId); await assertScopedAccess(context, userId, (playerId) => repository.isPlayerAssignedToTournament(tournamentId, playerId)); return (await repository.listTournamentLeaderboard(tournamentId)).map((row, idx) => ({ ...leaderboardDto(row), rank: row.rank || idx + 1 })); }

export async function getQualifications(roundId, userId) { const context = await repository.getRoundContext(roundId); await assertScopedAccess(context, userId, (playerId) => repository.isPlayerAssignedToRound(roundId, playerId)); return (await repository.listQualifications(roundId)).map(qualificationDto); }
export async function selectQualification(roundId, input, userId) {
  const context = await repository.getRoundContext(roundId);
  if (!context) throw errorResponses.notFound('Round not found');
  if (context.organizer_id !== userId) {
    await assertTournamentAuthorization(context.tournament_id, userId, {
      permission: PERMISSIONS.MANAGE_QUALIFICATIONS,
      isWrite: true,
    });
  }
  if (context.tournament_status === 'COMPLETED') throw errorResponses.conflict('Completed tournaments are read-only');
  if (context.status === 'COMPLETED') throw errorResponses.conflict('Completed rounds are read-only');
  const assigned = await repository.getTeamInRound(roundId, input.teamId);
  if (!assigned) throw errorResponses.validation({ teamId: 'Only a team assigned in this round can qualify' });
  try {
    await repository.insertQualification({
      roundId,
      teamId: input.teamId,
      sourceGroupId: input.sourceGroupId || assigned.group_id,
      rankAtQualification: input.rankAtQualification,
      selectedBy: userId,
    });
    await staffRepo.insertAuditLog({
      tournamentId: context.tournament_id,
      userId,
      actorId: userId,
      action: 'QUALIFICATION_SELECTED',
      entityType: 'QUALIFICATION',
      entityId: Number(input.teamId),
      metadata: { roundId, teamId: input.teamId, rank: input.rankAtQualification },
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw errorResponses.conflict('Team is already qualified for this round');
    throw error;
  }
  return getQualifications(roundId, userId);
}

export async function removeQualification(roundId, teamId, userId) {
  const context = await repository.getRoundContext(roundId);
  if (!context) throw errorResponses.notFound('Round not found');
  if (context.organizer_id !== userId) {
    await assertTournamentAuthorization(context.tournament_id, userId, {
      permission: PERMISSIONS.MANAGE_QUALIFICATIONS,
      isWrite: true,
    });
  }
  if (context.status === 'COMPLETED') throw errorResponses.conflict('Completed rounds are read-only');
  await repository.deleteQualification(roundId, teamId);
  await staffRepo.insertAuditLog({
    tournamentId: context.tournament_id,
    userId,
    actorId: userId,
    action: 'QUALIFICATION_REMOVED',
    entityType: 'QUALIFICATION',
    entityId: Number(teamId),
    metadata: { roundId, teamId },
  });
  return getQualifications(roundId, userId);
}
export async function countRoundQualifications(roundId) { return repository.countQualifications(roundId); }

export async function getQualificationCenterData(roundId, userId) {
  const context = await repository.getRoundContext(roundId);
  await assertScopedAccess(context, userId, (playerId) => repository.isPlayerAssignedToRound(roundId, playerId));

  const groups = await compRepo.listGroups(roundId);
  const groupData = await Promise.all(
    groups.map(async (grp) => {
      const leaderboard = (await repository.listGroupLeaderboard(grp.id)).map((row, idx) => ({
        ...leaderboardDto(row),
        rank: idx + 1,
      }));
      return {
        id: grp.id,
        name: grp.name,
        status: grp.status,
        groupSize: grp.groupSize,
        teams: grp.teams,
        leaderboard,
      };
    })
  );

  const qualifications = (await repository.listQualifications(roundId)).map(qualificationDto);

  return {
    roundId: Number(roundId),
    roundNumber: context.round_number,
    isFinalized: Boolean(context.qualifications_finalized_at),
    qualificationsFinalizedAt: context.qualifications_finalized_at || null,
    groups: groupData,
    qualifications,
  };
}

export async function finalizeQualifications(roundId, input, userId) {
  const context = await repository.getRoundContext(roundId);
  if (!context) throw errorResponses.notFound('Round not found');
  if (context.organizer_id !== userId) {
    await assertTournamentAuthorization(context.tournament_id, userId, {
      permission: PERMISSIONS.MANAGE_QUALIFICATIONS,
      isWrite: true,
    });
  }
  if (context.tournament_status === 'COMPLETED') throw errorResponses.conflict('Completed tournaments are read-only');
  if (context.status === 'COMPLETED') throw errorResponses.conflict('Completed rounds are read-only');

  const incompleteCount = await compRepo.countIncompleteGroups(roundId);
  if (incompleteCount > 0) {
    throw errorResponses.conflict('Every group must be completed before finalizing qualifications');
  }

  const selections = input.selections || [];
  if (!Array.isArray(selections) || selections.length === 0) {
    throw errorResponses.conflict('At least one qualifying team must be selected');
  }

  // Validate no duplicate team IDs
  const teamIds = selections.map((s) => Number(s.teamId));
  if (new Set(teamIds).size !== teamIds.length) {
    throw errorResponses.conflict('Duplicate qualifying team selections are not allowed');
  }

  // Verify all teams belong to this round
  for (const sel of selections) {
    const assigned = await repository.getTeamInRound(roundId, sel.teamId);
    if (!assigned) {
      throw errorResponses.validation({ teamId: `Team ${sel.teamId} is not assigned to this round` });
    }
    if (!sel.sourceGroupId) {
      sel.sourceGroupId = assigned.group_id;
    }
  }

  const result = await repository.finalizeQualificationsBatch(roundId, selections, userId);
  await staffRepo.insertAuditLog({
    tournamentId: context.tournament_id,
    userId,
    actorId: userId,
    action: 'QUALIFICATIONS_FINALIZED',
    entityType: 'ROUND_QUALIFICATIONS',
    entityId: Number(roundId),
    metadata: { roundId, totalQualified: selections.length },
  });

  emitRealtime(realtimeRooms.tournament(context.tournament_id), realtimeEvents.qualificationFinalized, {
    roundId: Number(roundId),
    roundNumber: context.round_number,
    totalQualified: selections.length,
  });

  return result.map(qualificationDto);
}

export async function reopenQualifications(roundId, userId) {
  const context = await repository.getRoundContext(roundId);
  if (!context) throw errorResponses.notFound('Round not found');
  if (context.organizer_id !== userId) {
    await assertTournamentAuthorization(context.tournament_id, userId, {
      permission: PERMISSIONS.MANAGE_QUALIFICATIONS,
      isWrite: true,
    });
  }
  if (context.status === 'COMPLETED') throw errorResponses.conflict('Completed rounds are read-only');

  try {
    const result = await repository.reopenRoundQualifications(roundId);
    await staffRepo.insertAuditLog({
      tournamentId: context.tournament_id,
      userId,
      actorId: userId,
      action: 'QUALIFICATIONS_REOPENED',
      entityType: 'ROUND_QUALIFICATIONS',
      entityId: Number(roundId),
    });
    return result.map(qualificationDto);
  } catch (error) {
    if (error.code === 'NEXT_ROUND_STARTED') {
      throw errorResponses.conflict(error.message);
    }
    throw error;
  }
}

