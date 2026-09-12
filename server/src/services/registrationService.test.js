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
  listTeamMembersWithProfiles: vi.fn(),
  insertRegistrationMemberSnapshots: vi.fn(),
}));
vi.mock('../repositories/tournamentRepository.js', () => ({ findTournament: vi.fn(), findTournamentForUpdate: vi.fn() }));
vi.mock('../repositories/paymentRepository.js', () => ({
  findPaymentByRegistrationId: vi.fn(),
  findPaymentByTxRef: vi.fn(),
  updatePayment: vi.fn(),
  insertAuditLog: vi.fn(),
  insertPayment: vi.fn(),
}));

const repository = await import('../repositories/registrationRepository.js');
const tournamentRepository = await import('../repositories/tournamentRepository.js');
const { createPlayerRegistration, listTournamentRegistrationsPage, reviewTournamentRegistration } = await import('./registrationService.js');

describe('registration service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tournamentRepository.findTournamentForUpdate.mockResolvedValue({ id: 5, organizer_id: 4, status: 'REGISTRATION_OPEN', max_teams: 10, entry_type: 'PAID', entry_fee: 100, payment_method: 'MANUAL_UPI', game: 'Free Fire' });
    repository.getTournamentRegistrationCountForUpdate = vi.fn().mockResolvedValue(0);
    repository.listTeamMembersWithProfiles.mockResolvedValue([
      { user_id: 4, player_name: 'Owner', email: 'owner@example.com', unique_player_id: 'EVQ-1', mobile: '9999999999', in_game_name: 'OwnerIGN', game_uid: 'OwnerUID' },
      { user_id: 5, player_name: 'Player2', email: 'player2@example.com', unique_player_id: 'EVQ-2', mobile: '8888888888', in_game_name: 'Player2IGN', game_uid: 'Player2UID' }
    ]);
    repository.insertRegistrationMemberSnapshots.mockResolvedValue(null);
  });

  it('requires the team owner, open lifecycle, exact team size, and paid evidence', async () => {
    repository.getRegistrationContext.mockResolvedValue({ tournament_id: 5, tournament_status: 'REGISTRATION_OPEN', entry_type: 'PAID', players_per_team: 2, owner_id: 4, team_id: 7, member_count: 2 });

    await expect(createPlayerRegistration(5, { teamId: 7, transactionId: '' }, 4, null))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(createPlayerRegistration(5, { teamId: 7, transactionId: 'tx' }, 9, null))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects duplicate registration and only permits pending review', async () => {
    tournamentRepository.findTournamentForUpdate.mockResolvedValue({ id: 5, organizer_id: 4, status: 'REGISTRATION_OPEN', max_teams: 10, entry_type: 'FREE', entry_fee: 0 });
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

  it('rejects registration review on a COMPLETED tournament for the organizer owner', async () => {
    repository.findRegistration.mockResolvedValue([{ id: 3, tournament_id: 5, tournament_status: 'COMPLETED', team_id: 7, status: 'PENDING', entry_type: 'FREE', organizer_id: 4, team_name: 'Alpha', tournament_name: 'Cup', member_id: 4, member_name: 'Owner', member_email: 'owner@example.com', unique_player_id: 'EVQ-1' }]);
    await expect(reviewTournamentRegistration(3, { status: 'VERIFIED' }, 4))
      .rejects.toMatchObject({ code: 'CONFLICT', message: 'Completed tournaments are read-only' });
  });

  it('paginates complete registrations without splitting member rows', async () => {
    const row = { id: 3, tournament_id: 5, team_id: 7, status: 'VERIFIED', entry_type: 'FREE', organizer_id: 4, team_name: 'Alpha', tournament_name: 'Cup', member_id: 4, member_name: 'Owner', member_email: 'owner@example.com', unique_player_id: 'EVQ-1' };
    tournamentRepository.findTournament.mockResolvedValue({ organizer_id: 4 });
    repository.listRegistrations.mockResolvedValue([row]);
    repository.countRegistrations.mockResolvedValue(1);
    await expect(listTournamentRegistrationsPage(5, 4, { page: 1, limit: 20 })).resolves.toMatchObject({ pagination: { total: 1 }, registrations: [{ members: [{ uniquePlayerId: 'EVQ-1' }] }] });
  });

  it('validates registration prechecks for bulk actions', async () => {
    const { precheckBulkVerification } = await import('./registrationService.js');
    repository.findRegistration.mockResolvedValue([{ id: 10, tournament_id: 5, team_id: 7, status: 'PENDING', entry_type: 'PAID', payment_status: 'PAYMENT_SUBMITTED', payment_amount: 100, proof_url: 'ss.png', transaction_reference: 'TX123', organizer_id: 4, team_name: 'Beta', tournament_name: 'Cup', member_id: 4, member_name: 'Player', member_email: 'p@example.com', unique_player_id: 'EVQ-2' }]);
    
    const prechecks = await precheckBulkVerification([10], 4);
    expect(prechecks[0]).toMatchObject({ id: 10, check: 'Eligible' });
  });

  it('runs bulk rejection successfully', async () => {
    const { bulkRejectRegistrations } = await import('./registrationService.js');
    repository.findRegistration.mockResolvedValue([{ id: 12, tournament_id: 5, team_id: 8, status: 'PENDING', entry_type: 'FREE', organizer_id: 4, team_name: 'Gamma', tournament_name: 'Cup', member_id: 5, member_name: 'P3', member_email: 'p3@example.com', unique_player_id: 'EVQ-3' }]);
    repository.reviewRegistration.mockResolvedValue(1);

    const result = await bulkRejectRegistrations([12], 'Invalid credentials', 4);
    expect(result.rejectedCount).toBe(1);
    expect(result.rejectedIds).toContain(12);
  });
});
