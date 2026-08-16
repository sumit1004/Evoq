import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/registrationRepository.js', () => ({
  findPlayerRegistration: vi.fn(),
  findRegistration: vi.fn(),
  findRegistrationFile: vi.fn(),
  getRegistrationContext: vi.fn(),
  insertRegistration: vi.fn(),
  countRegistrations: vi.fn(),
  listPlayerRegistrations: vi.fn(),
  listRegistrations: vi.fn(),
  reviewRegistration: vi.fn(),
}));
vi.mock('../repositories/tournamentRepository.js', () => ({ findTournament: vi.fn() }));

const repository = await import('../repositories/registrationRepository.js');
const tournamentRepository = await import('../repositories/tournamentRepository.js');
const { createPlayerRegistration, listTournamentRegistrationsPage, reviewTournamentRegistration } = await import('./registrationService.js');

describe('registration service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires the team owner, open lifecycle, exact team size, and paid evidence', async () => {
    repository.getRegistrationContext.mockResolvedValue({ tournament_id: 5, tournament_status: 'REGISTRATION_OPEN', entry_type: 'PAID', players_per_team: 2, owner_id: 4, team_id: 7, member_count: 2 });

    await expect(createPlayerRegistration(5, { teamId: 7, transactionId: '' }, 4, null))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(createPlayerRegistration(5, { teamId: 7, transactionId: 'tx' }, 9, null))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects duplicate registration and only permits pending review', async () => {
    repository.getRegistrationContext.mockResolvedValue({ tournament_status: 'REGISTRATION_OPEN', entry_type: 'FREE', players_per_team: 1, owner_id: 4, member_count: 1 });
    repository.insertRegistration.mockRejectedValue({ code: 'ER_DUP_ENTRY' });
    await expect(createPlayerRegistration(5, { teamId: 7 }, 4, null))
      .rejects.toMatchObject({ code: 'CONFLICT' });

    repository.findRegistration.mockResolvedValue([{ id: 3, tournament_id: 5, team_id: 7, status: 'VERIFIED', entry_type: 'FREE', organizer_id: 4, team_name: 'Alpha', tournament_name: 'Cup', member_id: 4, member_name: 'Owner', member_email: 'owner@example.com', unique_player_id: 'EVQ-1' }]);
    await expect(reviewTournamentRegistration(3, { status: 'REJECTED', rejectionReason: 'No longer eligible' }, 4))
      .rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('requires the tournament owner to review a pending registration', async () => {
    repository.findRegistration.mockResolvedValue([{ id: 3, tournament_id: 5, team_id: 7, status: 'PENDING', entry_type: 'FREE', organizer_id: 4, team_name: 'Alpha', tournament_name: 'Cup', member_id: 4, member_name: 'Owner', member_email: 'owner@example.com', unique_player_id: 'EVQ-1' }]);
    await expect(reviewTournamentRegistration(3, { status: 'VERIFIED' }, 9))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('paginates complete registrations without splitting member rows', async () => {
    const row = { id: 3, tournament_id: 5, team_id: 7, status: 'VERIFIED', entry_type: 'FREE', organizer_id: 4, team_name: 'Alpha', tournament_name: 'Cup', member_id: 4, member_name: 'Owner', member_email: 'owner@example.com', unique_player_id: 'EVQ-1' };
    tournamentRepository.findTournament.mockResolvedValue({ organizer_id: 4 });
    repository.listRegistrations.mockResolvedValue([row]);
    repository.countRegistrations.mockResolvedValue(1);
    await expect(listTournamentRegistrationsPage(5, 4, { page: 1, limit: 20 })).resolves.toMatchObject({ pagination: { total: 1 }, registrations: [{ members: [{ uniquePlayerId: 'EVQ-1' }] }] });
  });
});
