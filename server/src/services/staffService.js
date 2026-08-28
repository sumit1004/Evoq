import { errorResponses } from '../errors/AppError.js';
import { pool } from '../config/database.js';
import * as staffRepo from '../repositories/staffRepository.js';
import { findTournament } from '../repositories/tournamentRepository.js';
import { findUserById } from '../repositories/identityRepository.js';
import { emitRealtime, realtimeRooms } from '../utils/realtimeHub.js';
import { PERMISSIONS } from './authorizationService.js';

export async function searchScouts(query, organizerId) {
  if (!query?.trim()) return [];
  return staffRepo.searchScouts(query.trim(), organizerId);
}

export async function listOrganizationScouts(organizerId) {
  const org = await staffRepo.ensureDefaultOrganization(organizerId);
  return staffRepo.listOrganizationScouts(org.id);
}

export async function listTournamentScouts(tournamentId, organizerId) {
  const tournament = await findTournament(tournamentId);
  if (!tournament || tournament.organizer_id !== organizerId) {
    throw errorResponses.notFound('Tournament not found');
  }
  return staffRepo.listTournamentStaff(tournamentId);
}

export async function getTournamentStaffDetails(tournamentId, staffId, organizerId) {
  const staff = await staffRepo.findTournamentStaffById(staffId);
  if (!staff || staff.tournament_id !== Number(tournamentId) || staff.organizer_id !== organizerId) {
    throw errorResponses.notFound('Staff record not found');
  }
  const allStaff = await staffRepo.listTournamentStaff(tournamentId);
  return allStaff.find((s) => s.id === Number(staffId)) || null;
}

export async function assignScout(tournamentId, input, organizerId) {
  const tournament = await findTournament(tournamentId);
  if (!tournament || tournament.organizer_id !== organizerId) {
    throw errorResponses.notFound('Tournament not found');
  }
  if (tournament.status === 'COMPLETED') {
    throw errorResponses.conflict('Completed tournaments are read-only');
  }

  const candidateUserId = Number(input.userId);
  if (!candidateUserId || candidateUserId === organizerId) {
    throw errorResponses.validation({ userId: 'Invalid scout user specified' });
  }

  const candidateUser = await findUserById(candidateUserId);
  if (!candidateUser) {
    throw errorResponses.notFound('User not found');
  }

  const permissions = Array.isArray(input.permissions)
    ? input.permissions.filter((p) => Object.values(PERMISSIONS).includes(p))
    : [];

  const allGroups = Boolean(input.allGroups);
  const groupIds = Array.isArray(input.groupIds) ? input.groupIds.map(Number).filter(Boolean) : [];

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const org = await staffRepo.ensureDefaultOrganization(organizerId, connection);

    // Update tournament organization_id if not set
    if (!tournament.organization_id) {
      await connection.query('UPDATE tournaments SET organization_id = ? WHERE id = ?', [org.id, tournamentId]);
    }

    // Add as organization member
    await staffRepo.ensureOrganizationMember(org.id, candidateUserId, 'SCOUT', connection);

    // Insert or update staff record
    const staffId = await staffRepo.insertTournamentStaff({
      organizationId: org.id,
      tournamentId,
      userId: candidateUserId,
      allGroups,
      createdBy: organizerId,
    }, connection);

    // Clean old & insert new permissions
    await staffRepo.deleteStaffPermissions(staffId, connection);
    if (permissions.length > 0) {
      await staffRepo.insertStaffPermissions(staffId, permissions, connection);
    }

    // Clean old & insert new group assignments
    await staffRepo.deleteStaffGroupAssignments(staffId, connection);
    if (!allGroups && groupIds.length > 0) {
      await staffRepo.insertStaffGroupAssignments(staffId, groupIds, connection);
    }

    // Audit log
    await staffRepo.insertAuditLog({
      organizationId: org.id,
      tournamentId,
      userId: organizerId,
      actorId: organizerId,
      action: 'SCOUT_ASSIGNED',
      entityType: 'TOURNAMENT_STAFF',
      entityId: staffId,
      metadata: {
        scoutUserId: candidateUserId,
        scoutName: candidateUser.name,
        permissions,
        allGroups,
        groupIds,
      },
    }, connection);

    await connection.commit();

    // Emit realtime event to the assigned scout
    emitRealtime(realtimeRooms.user(candidateUserId), 'staff_access_updated', {
      tournamentId: Number(tournamentId),
      staffId,
      status: 'ACTIVE',
      permissions,
      allGroups,
      groupIds,
    });

    const staffList = await staffRepo.listTournamentStaff(tournamentId);
    return staffList.find((s) => s.id === staffId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateScoutAccess(tournamentId, staffId, input, organizerId) {
  const staff = await staffRepo.findTournamentStaffById(staffId);
  if (!staff || staff.tournament_id !== Number(tournamentId) || staff.organizer_id !== organizerId) {
    throw errorResponses.notFound('Staff record not found');
  }
  if (staff.tournament_status === 'COMPLETED') {
    throw errorResponses.conflict('Completed tournaments are read-only');
  }

  const permissions = Array.isArray(input.permissions)
    ? input.permissions.filter((p) => Object.values(PERMISSIONS).includes(p))
    : [];

  const allGroups = input.allGroups !== undefined ? Boolean(input.allGroups) : staff.all_groups;
  const groupIds = Array.isArray(input.groupIds) ? input.groupIds.map(Number).filter(Boolean) : [];
  const status = input.status === 'REVOKED' ? 'REVOKED' : 'ACTIVE';

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await staffRepo.updateTournamentStaff(staffId, { allGroups, status }, connection);

    await staffRepo.deleteStaffPermissions(staffId, connection);
    if (status === 'ACTIVE' && permissions.length > 0) {
      await staffRepo.insertStaffPermissions(staffId, permissions, connection);
    }

    await staffRepo.deleteStaffGroupAssignments(staffId, connection);
    if (status === 'ACTIVE' && !allGroups && groupIds.length > 0) {
      await staffRepo.insertStaffGroupAssignments(staffId, groupIds, connection);
    }

    // Audit log
    await staffRepo.insertAuditLog({
      organizationId: staff.organization_id,
      tournamentId: staff.tournament_id,
      userId: organizerId,
      actorId: organizerId,
      action: status === 'REVOKED' ? 'SCOUT_REVOKED' : 'SCOUT_PERMISSIONS_UPDATED',
      entityType: 'TOURNAMENT_STAFF',
      entityId: staffId,
      metadata: {
        scoutUserId: staff.user_id,
        scoutName: staff.user_name,
        permissions,
        allGroups,
        groupIds,
        status,
      },
    }, connection);

    await connection.commit();

    // Emit realtime event to scout
    emitRealtime(realtimeRooms.user(staff.user_id), 'staff_access_updated', {
      tournamentId: Number(tournamentId),
      staffId: Number(staffId),
      status,
      permissions,
      allGroups,
      groupIds,
    });

    const staffList = await staffRepo.listTournamentStaff(tournamentId);
    return staffList.find((s) => s.id === Number(staffId));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function revokeScoutAccess(tournamentId, staffId, organizerId) {
  const staff = await staffRepo.findTournamentStaffById(staffId);
  if (!staff || staff.tournament_id !== Number(tournamentId) || staff.organizer_id !== organizerId) {
    throw errorResponses.notFound('Staff record not found');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await staffRepo.updateTournamentStaff(staffId, { status: 'REVOKED' }, connection);

    await staffRepo.insertAuditLog({
      organizationId: staff.organization_id,
      tournamentId: staff.tournament_id,
      userId: organizerId,
      actorId: organizerId,
      action: 'SCOUT_REVOKED',
      entityType: 'TOURNAMENT_STAFF',
      entityId: staffId,
      metadata: {
        scoutUserId: staff.user_id,
        scoutName: staff.user_name,
      },
    }, connection);

    await connection.commit();

    emitRealtime(realtimeRooms.user(staff.user_id), 'staff_access_revoked', {
      tournamentId: Number(tournamentId),
      staffId: Number(staffId),
    });

    return { success: true, staffId: Number(staffId), status: 'REVOKED' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listTournamentAuditLogs(tournamentId, organizerId, options = {}) {
  const tournament = await findTournament(tournamentId);
  if (!tournament || tournament.organizer_id !== organizerId) {
    throw errorResponses.notFound('Tournament not found');
  }
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 50));
  const offset = (page - 1) * limit;
  const result = await staffRepo.listAuditLogs(tournamentId, { limit, offset });
  return {
    ...result,
    page,
    limit,
    totalPages: Math.ceil(result.total / limit),
  };
}

export async function listScoutAssignedTournaments(userId) {
  return staffRepo.listScoutAssignedTournaments(userId);
}

export async function getScoutTournamentAccess(tournamentId, userId) {
  const access = await staffRepo.getScoutPermissionsAndGroups(tournamentId, userId);
  if (!access || access.status !== 'ACTIVE') {
    throw errorResponses.notFound('No active scout assignment found for this tournament');
  }
  const tournament = await findTournament(tournamentId);
  return {
    ...access,
    tournamentName: tournament?.name,
    tournamentStatus: tournament?.status,
    tournamentGame: tournament?.game,
  };
}

export async function getScoutTournamentWorkspace(tournamentId, userId) {
  return getScoutTournamentAccess(tournamentId, userId);
}

export async function getScoutGroupWorkspace(tournamentId, groupId, userId) {
  const access = await getScoutTournamentAccess(tournamentId, userId);
  if (!access.allGroups && !access.assignedGroupIds.includes(Number(groupId))) {
    throw errorResponses.forbidden('You are not assigned to manage this group');
  }
  return {
    ...access,
    groupId: Number(groupId),
  };
}

// Aliases for controller compatibility
export const searchScoutCandidates = searchScouts;
export const listTournamentStaff = listTournamentScouts;
export const assignTournamentStaff = assignScout;
export const updateTournamentStaff = updateScoutAccess;
export const revokeTournamentStaff = revokeScoutAccess;
export const listAuditLogs = listTournamentAuditLogs;
export const listOrganizationStaff = listOrganizationScouts;
export const listScoutTournaments = listScoutAssignedTournaments;

