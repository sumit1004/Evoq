import { errorResponses } from '../errors/AppError.js';
import * as staffRepo from '../repositories/staffRepository.js';
import { findTournament } from '../repositories/tournamentRepository.js';

export const PERMISSIONS = {
  VIEW_TOURNAMENT: 'VIEW_TOURNAMENT',
  EDIT_TOURNAMENT: 'EDIT_TOURNAMENT',
  MANAGE_SETTINGS: 'MANAGE_SETTINGS',
  VIEW_REGISTRATIONS: 'VIEW_REGISTRATIONS',
  VERIFY_REGISTRATIONS: 'VERIFY_REGISTRATIONS',
  REJECT_REGISTRATIONS: 'REJECT_REGISTRATIONS',
  VIEW_PAYMENT_DETAILS: 'VIEW_PAYMENT_DETAILS',
  EXPORT_REGISTRATIONS: 'EXPORT_REGISTRATIONS',
  VIEW_ROUNDS: 'VIEW_ROUNDS',
  CREATE_ROUND: 'CREATE_ROUND',
  EDIT_ROUND: 'EDIT_ROUND',
  COMPLETE_ROUND: 'COMPLETE_ROUND',
  VIEW_GROUPS: 'VIEW_GROUPS',
  CREATE_GROUP: 'CREATE_GROUP',
  EDIT_GROUP: 'EDIT_GROUP',
  DELETE_GROUP: 'DELETE_GROUP',
  ASSIGN_TEAMS: 'ASSIGN_TEAMS',
  REMOVE_TEAMS: 'REMOVE_TEAMS',
  VIEW_MATCHES: 'VIEW_MATCHES',
  CREATE_MATCH: 'CREATE_MATCH',
  EDIT_MATCH: 'EDIT_MATCH',
  DELETE_MATCH: 'DELETE_MATCH',
  START_MATCH: 'START_MATCH',
  COMPLETE_MATCH: 'COMPLETE_MATCH',
  VIEW_ROOM: 'VIEW_ROOM',
  EDIT_ROOM: 'EDIT_ROOM',
  VIEW_RESULTS: 'VIEW_RESULTS',
  ENTER_RESULTS: 'ENTER_RESULTS',
  EDIT_RESULTS: 'EDIT_RESULTS',
  VIEW_LEADERBOARD: 'VIEW_LEADERBOARD',
  MANAGE_LEADERBOARD: 'MANAGE_LEADERBOARD',
  VIEW_QUALIFICATIONS: 'VIEW_QUALIFICATIONS',
  MANAGE_QUALIFICATIONS: 'MANAGE_QUALIFICATIONS',
  VIEW_ANNOUNCEMENTS: 'VIEW_ANNOUNCEMENTS',
  CREATE_ANNOUNCEMENTS: 'CREATE_ANNOUNCEMENTS',
  MANAGE_GROUP_CHAT: 'MANAGE_GROUP_CHAT',
  START_TOURNAMENT: 'START_TOURNAMENT',
  COMPLETE_TOURNAMENT: 'COMPLETE_TOURNAMENT',
  MANAGE_SCOUTS: 'MANAGE_SCOUTS',
  DELETE_TOURNAMENT: 'DELETE_TOURNAMENT',
  TRANSFER_TOURNAMENT: 'TRANSFER_TOURNAMENT',
};

export const OWNER_ONLY_PERMISSIONS = new Set([
  PERMISSIONS.MANAGE_SCOUTS,
  PERMISSIONS.DELETE_TOURNAMENT,
  PERMISSIONS.TRANSFER_TOURNAMENT,
]);

export function isValidPermission(permission) {
  return Boolean(PERMISSIONS[permission]);
}

export const PERMISSION_GROUPS = [
  {
    category: 'Tournament & Settings',
    permissions: [
      { key: PERMISSIONS.VIEW_TOURNAMENT, label: 'View Tournament' },
      { key: PERMISSIONS.EDIT_TOURNAMENT, label: 'Edit Tournament Details' },
      { key: PERMISSIONS.MANAGE_SETTINGS, label: 'Manage Tournament Settings' },
      { key: PERMISSIONS.START_TOURNAMENT, label: 'Start Tournament' },
      { key: PERMISSIONS.COMPLETE_TOURNAMENT, label: 'Complete Tournament' },
    ],
  },
  {
    category: 'Registrations & Payments',
    permissions: [
      { key: PERMISSIONS.VIEW_REGISTRATIONS, label: 'View Registrations' },
      { key: PERMISSIONS.VERIFY_REGISTRATIONS, label: 'Verify Registrations' },
      { key: PERMISSIONS.REJECT_REGISTRATIONS, label: 'Reject Registrations' },
      { key: PERMISSIONS.VIEW_PAYMENT_DETAILS, label: 'View Payment Details & Proof' },
      { key: PERMISSIONS.EXPORT_REGISTRATIONS, label: 'Export Registrations (CSV/Excel)' },
    ],
  },
  {
    category: 'Rounds',
    permissions: [
      { key: PERMISSIONS.VIEW_ROUNDS, label: 'View Rounds' },
      { key: PERMISSIONS.CREATE_ROUND, label: 'Create Rounds' },
      { key: PERMISSIONS.EDIT_ROUND, label: 'Edit Round Status' },
      { key: PERMISSIONS.COMPLETE_ROUND, label: 'Complete Rounds' },
    ],
  },
  {
    category: 'Groups',
    permissions: [
      { key: PERMISSIONS.VIEW_GROUPS, label: 'View Groups' },
      { key: PERMISSIONS.CREATE_GROUP, label: 'Create Groups' },
      { key: PERMISSIONS.EDIT_GROUP, label: 'Edit Group & Status' },
      { key: PERMISSIONS.DELETE_GROUP, label: 'Delete Groups' },
      { key: PERMISSIONS.ASSIGN_TEAMS, label: 'Assign Teams to Groups' },
      { key: PERMISSIONS.REMOVE_TEAMS, label: 'Remove Teams from Groups' },
    ],
  },
  {
    category: 'Matches & Rooms',
    permissions: [
      { key: PERMISSIONS.VIEW_MATCHES, label: 'View Matches' },
      { key: PERMISSIONS.CREATE_MATCH, label: 'Create Matches' },
      { key: PERMISSIONS.EDIT_MATCH, label: 'Edit Match Schedule/Details' },
      { key: PERMISSIONS.DELETE_MATCH, label: 'Delete Matches' },
      { key: PERMISSIONS.START_MATCH, label: 'Start Match (LIVE)' },
      { key: PERMISSIONS.COMPLETE_MATCH, label: 'Complete Matches' },
      { key: PERMISSIONS.VIEW_ROOM, label: 'View Room ID & Password' },
      { key: PERMISSIONS.EDIT_ROOM, label: 'Update Room ID & Password' },
    ],
  },
  {
    category: 'Results & Leaderboards',
    permissions: [
      { key: PERMISSIONS.VIEW_RESULTS, label: 'View Match Results' },
      { key: PERMISSIONS.ENTER_RESULTS, label: 'Record / Enter Match Results' },
      { key: PERMISSIONS.EDIT_RESULTS, label: 'Edit Recorded Match Results' },
      { key: PERMISSIONS.VIEW_LEADERBOARD, label: 'View Leaderboards' },
      { key: PERMISSIONS.MANAGE_LEADERBOARD, label: 'Recalculate / Manage Leaderboard' },
    ],
  },
  {
    category: 'Qualifications',
    permissions: [
      { key: PERMISSIONS.VIEW_QUALIFICATIONS, label: 'View Qualifications' },
      { key: PERMISSIONS.MANAGE_QUALIFICATIONS, label: 'Select / Finalize Qualifications' },
    ],
  },
  {
    category: 'Communication',
    permissions: [
      { key: PERMISSIONS.VIEW_ANNOUNCEMENTS, label: 'View Announcements' },
      { key: PERMISSIONS.CREATE_ANNOUNCEMENTS, label: 'Create Announcements' },
      { key: PERMISSIONS.MANAGE_GROUP_CHAT, label: 'Manage & Send Group Chat' },
    ],
  },
];

/**
 * Resolves user authorization for a tournament:
 * Returns: { isOwner, isOrganizer, isStaff, isScout, staffId, permissions: Set<string>, allGroups: boolean, assignedGroupIds: Set<number> }
 */
export async function resolveTournamentStaffContext(tournamentId, userId, connection) {
  const tournament = await findTournament(tournamentId, connection);
  if (!tournament) return null;

  const isDirectOwner = Number(tournament.organizer_id) === Number(userId);

  if (isDirectOwner) {
    return {
      tournament,
      isOwner: true,
      isStaff: true,
      isScout: false,
      staffId: null,
      allGroups: true,
      assignedGroupIds: new Set(),
      permissions: new Set(Object.values(PERMISSIONS)),
    };
  }

  const staffAccess = await staffRepo.getScoutPermissionsAndGroups(tournamentId, userId, connection);
  if (!staffAccess || staffAccess.status !== 'ACTIVE') {
    return {
      tournament,
      isOwner: false,
      isStaff: false,
      isScout: false,
      staffId: null,
      allGroups: false,
      assignedGroupIds: new Set(),
      permissions: new Set(),
    };
  }

  return {
    tournament,
    isOwner: false,
    isStaff: true,
    isScout: true,
    staffId: staffAccess.staffId,
    allGroups: staffAccess.allGroups,
    assignedGroupIds: new Set(staffAccess.assignedGroupIds.map(Number)),
    permissions: new Set(staffAccess.permissions),
  };
}

/**
 * Asserts authorization on a tournament with optional permission and lifecycle write restrictions
 */
export async function assertTournamentAuthorization(tournamentId, userId, {
  permission = null,
  isWrite = false,
  groupId = null,
  connection,
} = {}) {
  const context = await resolveTournamentStaffContext(tournamentId, userId, connection);
  if (!context || (!context.isOwner && !context.isStaff)) {
    throw errorResponses.notFound('Tournament not found');
  }

  if (isWrite && context.tournament.status === 'COMPLETED') {
    throw errorResponses.conflict('Completed tournaments are read-only');
  }

  if (context.isOwner) {
    return context;
  }

  // If Scout, verify permission
  if (permission && !context.permissions.has(permission)) {
    throw errorResponses.forbidden('You do not have permission to perform this tournament action');
  }

  // If group-scoped, verify group access
  if (groupId && !context.allGroups) {
    if (!context.assignedGroupIds.has(Number(groupId))) {
      throw errorResponses.forbidden('You are not assigned to manage this group');
    }
  }

  return context;
}

/**
 * Returns normalized effective access for a user and tournament.
 * Used by controllers and frontend management workspace.
 */
export async function getEffectiveTournamentAccess(userId, tournamentId, connection) {
  const context = await resolveTournamentStaffContext(tournamentId, userId, connection);
  if (!context || !context.tournament) return null;

  if (context.isOwner) {
    return {
      userId: Number(userId),
      tournamentId: Number(tournamentId),
      role: 'ORGANIZER',
      isOwner: true,
      isStaff: true,
      isScout: false,
      allGroups: true,
      permissions: Object.values(PERMISSIONS),
      assignedGroupIds: [],
      allowedModules: {
        overview: true,
        rounds: true,
        registrations: true,
        leaderboard: true,
        announcements: true,
        settings: true,
        scouts: true,
      },
    };
  }

  if (context.isStaff && context.isScout) {
    const perms = context.permissions;
    return {
      userId: Number(userId),
      tournamentId: Number(tournamentId),
      role: 'SCOUT',
      isOwner: false,
      isStaff: true,
      isScout: true,
      allGroups: context.allGroups,
      permissions: Array.from(perms),
      assignedGroupIds: Array.from(context.assignedGroupIds),
      allowedModules: {
        overview: perms.has(PERMISSIONS.VIEW_TOURNAMENT) || perms.size > 0,
        rounds: perms.has(PERMISSIONS.VIEW_ROUNDS) || perms.has(PERMISSIONS.VIEW_GROUPS) || perms.has(PERMISSIONS.VIEW_MATCHES),
        registrations: perms.has(PERMISSIONS.VIEW_REGISTRATIONS),
        leaderboard: perms.has(PERMISSIONS.VIEW_LEADERBOARD),
        announcements: perms.has(PERMISSIONS.VIEW_ANNOUNCEMENTS),
        settings: perms.has(PERMISSIONS.MANAGE_SETTINGS),
        scouts: false,
      },
    };
  }

  return {
    userId: Number(userId),
    tournamentId: Number(tournamentId),
    role: 'PLAYER',
    isOwner: false,
    isStaff: false,
    isScout: false,
    allGroups: false,
    permissions: [],
    assignedGroupIds: [],
    allowedModules: {
      overview: false,
      rounds: false,
      registrations: false,
      leaderboard: false,
      announcements: false,
      settings: false,
      scouts: false,
    },
  };
}
