import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/archiveRepository.js', () => ({
  listArchives: vi.fn(), findArchive: vi.fn(), deleteArchive: vi.fn(),
}));

import * as repository from '../repositories/archiveRepository.js';
import { deleteHistory, getHistoryById, listHistory } from './archiveService.js';

describe('archive history access', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serializes stored archive JSON for history reads', async () => {
    repository.listArchives.mockResolvedValue([{ id: 1, tournament_id: 7, tournament_name: 'Finals', completed_at: '2026-08-16T00:00:00Z', registration_count: 4, final_leaderboard_json: '[{"teamId":2}]', qualified_teams_json: '[]', winners_json: '[]', summary_json: '{}', created_at: '2026-08-16T00:00:00Z' }]);
    await expect(listHistory()).resolves.toMatchObject([{ id: 1, tournamentId: 7, finalLeaderboard: [{ teamId: 2 }] }]);
  });

  it('returns not found for a missing archive', async () => {
    repository.findArchive.mockResolvedValue(null);
    await expect(getHistoryById(99)).rejects.toMatchObject({ status: 404 });
  });

  it('blocks an organizer from deleting another organizer archive', async () => {
    repository.findArchive.mockResolvedValue({ id: 1, tournament_id: 7, organizer_id: 8 });
    await expect(deleteHistory(1, { id: 9, role: 'ORGANIZER' })).rejects.toMatchObject({ status: 403 });
  });
});
