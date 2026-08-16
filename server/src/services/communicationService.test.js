import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/communicationRepository.js', () => ({
  getTournamentAccess: vi.fn(), getGroupAccess: vi.fn(), listAnnouncements: vi.fn(), createAnnouncement: vi.fn(), listTournamentParticipantIds: vi.fn(), createNotifications: vi.fn(),
  findAnnouncement: vi.fn(), deleteAnnouncement: vi.fn(), listNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn(), listChatMessages: vi.fn(), createChatMessage: vi.fn(),
}));

import * as repository from '../repositories/communicationRepository.js';
import { createAnnouncement, sendChat } from './communicationService.js';

describe('communication authorization and notification rules', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects announcement writes from a non-owner', async () => {
    repository.getTournamentAccess.mockResolvedValue({ id: 4, organizer_id: 8, status: 'LIVE', is_participant: 1 });
    await expect(createAnnouncement(4, 'Notice', 12)).rejects.toMatchObject({ status: 403 });
  });

  it('persists announcement notifications for participants', async () => {
    repository.getTournamentAccess.mockResolvedValue({ id: 4, organizer_id: 8, status: 'LIVE' });
    repository.createAnnouncement.mockResolvedValue({ id: 3, tournament_id: 4, created_by: 8, creator_name: 'Organizer', message: 'Notice', created_at: new Date() });
    repository.listTournamentParticipantIds.mockResolvedValue([8, 12]);
    await expect(createAnnouncement(4, 'Notice', 8)).resolves.toMatchObject({ announcement: { id: 3 }, recipientIds: [8, 12] });
    expect(repository.createNotifications).toHaveBeenCalledWith([12], 4, 'ANNOUNCEMENT', 'Notice');
  });

  it('allows chat only for an assigned participant or organizer', async () => {
    repository.getGroupAccess.mockResolvedValue({ id: 5, organizer_id: 8, is_organizer: 0, is_participant: 0, tournament_status: 'LIVE' });
    await expect(sendChat(5, 'Hello', 12)).rejects.toMatchObject({ status: 404 });
  });
});
