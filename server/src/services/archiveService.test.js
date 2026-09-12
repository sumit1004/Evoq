import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPool = {
  getConnection: vi.fn(),
};

vi.mock('../config/database.js', () => ({
  pool: mockPool,
}));

vi.mock('../utils/realtimeHub.js', () => ({
  emitRealtime: vi.fn(),
  realtimeRooms: {
    tournament: (id) => `tournament:${id}`,
  },
}));

vi.mock('../repositories/archiveRepository.js', () => ({
  listArchives: vi.fn(),
  findArchive: vi.fn(),
  findArchiveByTournamentId: vi.fn(),
  deleteArchive: vi.fn(),
  getTournamentForCompletion: vi.fn(),
  getFinalRound: vi.fn(),
  countIncompleteGroups: vi.fn(),
  countIncompleteMatches: vi.fn(),
  getFinalLeaderboard: vi.fn(),
  getQualifications: vi.fn(),
  getTournamentAnnouncements: vi.fn(),
  getResultMediaPaths: vi.fn(),
  getRegistrationCount: vi.fn(),
  insertArchive: vi.fn(),
  markCompletedAndCleanup: vi.fn(),
  insertCleanupJobs: vi.fn(),
  markCleanupFile: vi.fn(),
}));

import * as repository from '../repositories/archiveRepository.js';
import { completeTournament, deleteHistory, getArchiveByTournamentId, getHistoryById, listHistory } from './archiveService.js';

describe('archive history access', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serializes stored archive JSON for history reads', async () => {
    repository.listArchives.mockResolvedValue([{
      id: 1,
      tournament_id: 7,
      tournament_name: 'Finals',
      completed_at: '2026-08-16T00:00:00Z',
      registration_count: 4,
      final_leaderboard_json: '[{"teamId":2}]',
      qualified_teams_json: '[]',
      winners_json: '[]',
      summary_json: '{}',
      created_at: '2026-08-16T00:00:00Z',
    }]);
    await expect(listHistory()).resolves.toMatchObject([{ id: 1, tournamentId: 7, finalLeaderboard: [{ teamId: 2 }] }]);
  });

  it('returns not found for a missing archive', async () => {
    repository.findArchive.mockResolvedValue(null);
    await expect(getHistoryById(99)).rejects.toMatchObject({ status: 404 });
  });

  it('fetches archive by tournament ID', async () => {
    repository.findArchiveByTournamentId.mockResolvedValue({
      id: 1,
      tournament_id: 7,
      tournament_name: 'Finals',
      completed_at: '2026-08-16T00:00:00Z',
      registration_count: 4,
      final_leaderboard_json: '[{"rank":1,"teamName":"Alpha","points":25}]',
      qualified_teams_json: '[]',
      winners_json: '[]',
      summary_json: '{}',
      created_at: '2026-08-16T00:00:00Z',
    });
    const result = await getArchiveByTournamentId(7);
    expect(result).toMatchObject({
      id: 1,
      tournamentId: 7,
      finalLeaderboard: [{ rank: 1, teamName: 'Alpha', points: 25 }],
    });
  });

  it('blocks an organizer from deleting another organizer archive', async () => {
    repository.findArchive.mockResolvedValue({ id: 1, tournament_id: 7, organizer_id: 8 });
    await expect(deleteHistory(1, { id: 9, role: 'ORGANIZER' })).rejects.toMatchObject({ status: 403 });
  });

  it('idempotently returns existing archive if tournament is already completed', async () => {
    const mockConn = {
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    };
    mockPool.getConnection.mockResolvedValue(mockConn);

    repository.getTournamentForCompletion.mockResolvedValue({
      id: 7,
      organizer_id: 2,
      status: 'COMPLETED',
    });
    repository.findArchiveByTournamentId.mockResolvedValue({
      id: 10,
      tournament_id: 7,
      tournament_name: 'Summer Cup',
      completed_at: '2026-08-30T00:00:00Z',
      registration_count: 12,
      final_leaderboard_json: '[{"rank":1,"teamName":"Champions"}]',
      qualified_teams_json: '[]',
      winners_json: '[]',
      summary_json: '{}',
    });

    const res = await completeTournament(7, 2);
    expect(res).toMatchObject({
      id: 10,
      tournamentId: 7,
      finalLeaderboard: [{ rank: 1, teamName: 'Champions' }],
    });
    expect(mockConn.rollback).toHaveBeenCalled();
    expect(mockConn.release).toHaveBeenCalled();
  });

  it('preserves announcements and snapshot summary during tournament completion', async () => {
    const mockConn = {
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    };
    mockPool.getConnection.mockResolvedValue(mockConn);

    repository.getTournamentForCompletion.mockResolvedValue({
      id: 8,
      organizer_id: 3,
      name: 'Pro League',
      status: 'LIVE',
    });
    repository.getFinalRound.mockResolvedValue({
      id: 20,
      name: 'Grand Finals',
      status: 'COMPLETED',
    });
    repository.countIncompleteGroups.mockResolvedValue(0);
    repository.countIncompleteMatches.mockResolvedValue(0);
    repository.getFinalLeaderboard.mockResolvedValue([
      { rank: 1, teamId: 101, teamName: 'Warriors', points: 50, kills: 20, matchesPlayed: 3 },
    ]);
    repository.getQualifications.mockResolvedValue([]);
    repository.getTournamentAnnouncements.mockResolvedValue([
      { id: 1, message: 'Finals starting at 6 PM', createdBy: 3, creatorName: 'Organizer', createdAt: '2026-09-01T12:00:00Z' },
    ]);
    repository.getResultMediaPaths.mockResolvedValue([]);
    repository.getRegistrationCount.mockResolvedValue(16);
    repository.insertArchive.mockResolvedValue(42);
    repository.findArchive.mockResolvedValue({
      id: 42,
      tournament_id: 8,
      organizer_id: 3,
      tournament_name: 'Pro League',
      completed_at: '2026-09-01T18:00:00Z',
      registration_count: 16,
      final_leaderboard_json: JSON.stringify([{ rank: 1, teamName: 'Warriors' }]),
      qualified_teams_json: '[]',
      winners_json: '[]',
      summary_json: JSON.stringify({
        announcements: [{ id: 1, message: 'Finals starting at 6 PM' }],
      }),
    });

    const res = await completeTournament(8, 3);
    expect(repository.insertArchive).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.objectContaining({
          announcements: expect.arrayContaining([
            expect.objectContaining({ message: 'Finals starting at 6 PM' }),
          ]),
        }),
      }),
      mockConn,
    );
    expect(repository.markCompletedAndCleanup).toHaveBeenCalledWith(8, mockConn);
    expect(res.id).toBe(42);
  });
});
