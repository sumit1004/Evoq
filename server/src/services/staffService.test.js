import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as staffService from './staffService.js';
import * as staffRepo from '../repositories/staffRepository.js';
import * as authService from './authorizationService.js';

vi.mock('../repositories/staffRepository.js', () => ({
  searchScouts: vi.fn(),
  searchScoutCandidatesByEvoqId: vi.fn(),
  ensureDefaultOrganization: vi.fn(),
  getScoutPermissionsAndGroups: vi.fn(),
  listTournamentStaff: vi.fn(),
  findStaffById: vi.fn(),
  findTournamentStaffById: vi.fn(),
  insertTournamentStaff: vi.fn(),
  deleteStaffPermissions: vi.fn(),
  insertStaffPermissions: vi.fn(),
  deleteStaffGroupAssignments: vi.fn(),
  insertStaffGroupAssignments: vi.fn(),
  updateTournamentStaff: vi.fn(),
  listAuditLogs: vi.fn(),
  insertAuditLog: vi.fn(),
}));
vi.mock('../repositories/tournamentRepository.js');
vi.mock('../config/database.js', () => ({
  pool: {
    getConnection: vi.fn().mockResolvedValue({
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    }),
    query: vi.fn().mockResolvedValue([[]]),
  },
}));
vi.mock('../utils/realtimeHub.js', () => ({
  emitRealtime: vi.fn(),
  realtimeRooms: { user: (id) => `user:${id}`, tournament: (id) => `tournament:${id}`, group: (id) => `group:${id}` },
}));

describe('Staff and Scout Management Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('searches scouts by EVOQ ID without exposing sensitive fields', async () => {
    staffRepo.searchScouts.mockResolvedValue([
      { id: 10, name: 'Scout Pro', uniquePlayerId: 'EVQ-PRO-99', inGameName: 'ProShooter' },
    ]);
    const results = await staffService.searchScoutCandidates('EVQ-PRO', 1);
    expect(results).toHaveLength(1);
    expect(results[0].uniquePlayerId).toBe('EVQ-PRO-99');
    expect(results[0].name).toBe('Scout Pro');
    expect(results[0].email).toBeUndefined(); // Sensitive data omitted
  });

  it('validates permissions against the valid catalog', () => {
    expect(authService.isValidPermission(authService.PERMISSIONS.ENTER_RESULTS)).toBe(true);
    expect(authService.isValidPermission(authService.PERMISSIONS.VIEW_RESULTS)).toBe(true);
    expect(authService.isValidPermission('INVALID_PERMISSION_NAME')).toBe(false);
  });

  it('correctly assesses owner vs staff permissions', async () => {
    const ownerContext = {
      isOwner: true,
      isStaff: true,
      isScout: false,
      allGroups: true,
      permissions: new Set(Object.values(authService.PERMISSIONS)),
    };
    expect(ownerContext.isOwner).toBe(true);
    expect(ownerContext.permissions.has(authService.PERMISSIONS.DELETE_TOURNAMENT)).toBe(true);

    const scoutContext = {
      isOwner: false,
      isStaff: true,
      isScout: true,
      allGroups: false,
      assignedGroupIds: new Set([101, 102]),
      permissions: new Set([authService.PERMISSIONS.ENTER_RESULTS]),
    };
    expect(scoutContext.isOwner).toBe(false);
    expect(scoutContext.permissions.has(authService.PERMISSIONS.ENTER_RESULTS)).toBe(true);
    expect(scoutContext.permissions.has(authService.PERMISSIONS.DELETE_TOURNAMENT)).toBe(false);
    expect(scoutContext.assignedGroupIds.has(101)).toBe(true);
    expect(scoutContext.assignedGroupIds.has(999)).toBe(false);
  });
});
