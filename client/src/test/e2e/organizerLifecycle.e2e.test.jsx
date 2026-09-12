import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { App } from '../../app/App.jsx';

vi.mock('../../services/tournamentApi.js', () => ({
  fetchOrganizerTournaments: vi.fn().mockResolvedValue({ tournaments: [] }),
  fetchTournament: vi.fn().mockResolvedValue({ tournament: { id: 1, name: 'Evoq Championship', status: 'LIVE' } }),
  fetchRegistrations: vi.fn().mockResolvedValue({ registrations: [] }),
  fetchScoringConfig: vi.fn().mockResolvedValue({ scoringConfig: { scoringMode: 'KILLS_AND_POSITION', killPointsPerKill: 1, positionPoints: [] } }),
  fetchTournamentAccess: vi.fn().mockResolvedValue({ access: { role: 'ORGANIZER', permissions: ['ALL'] } }),
}));

vi.mock('../../services/organizationApi.js', () => ({
  fetchOrganizationProfile: vi.fn().mockResolvedValue({ organization: { name: 'Evoq Org', slug: 'evoq-org' } }),
  updateOrganizationProfile: vi.fn().mockResolvedValue({ organization: { name: 'Evoq Org', slug: 'evoq-org' } }),
}));

vi.mock('../../services/competitionApi.js', () => ({
  fetchCompetitionSummary: vi.fn().mockResolvedValue({ rounds: [] }),
  fetchRounds: vi.fn().mockResolvedValue({ rounds: [] }),
  fetchTournamentLeaderboard: vi.fn().mockResolvedValue({ leaderboard: [] }),
}));

vi.mock('../../services/communicationApi.js', () => ({
  fetchAnnouncements: vi.fn().mockResolvedValue({ announcements: [] }),
  createAnnouncement: vi.fn().mockResolvedValue({ announcement: { id: 1, message: 'Welcome' } }),
}));

vi.mock('../../services/archiveApi.js', () => ({
  completeTournament: vi.fn().mockResolvedValue({ message: 'Completed' }),
  fetchTournamentArchive: vi.fn().mockResolvedValue({ archive: null }),
}));

vi.mock('../../services/staffApi.js', () => ({
  fetchTournamentStaff: vi.fn().mockResolvedValue({ staff: [] }),
  searchScouts: vi.fn().mockResolvedValue({ users: [] }),
}));

const mockOrganizerIdentity = {
  id: 201,
  name: 'Organizer One',
  email: 'organizer01@evoq.gg',
  role: 'ORGANIZER',
  token: 'jwt_organizer_01_token',
};

describe('Phase 5 E2E: Organizer Complete Tournament Lifecycle (ORGANIZER_01)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders organizer tournament management console', async () => {
    window.localStorage.setItem('evoq.token', mockOrganizerIdentity.token);
    window.localStorage.setItem('evoq.identity', JSON.stringify(mockOrganizerIdentity));

    render(
      <MemoryRouter initialEntries={['/organizer/tournaments']}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: /Tournaments/i })).toBeDefined();
  });

  it('renders organizer organization profile settings', async () => {
    window.localStorage.setItem('evoq.token', mockOrganizerIdentity.token);
    window.localStorage.setItem('evoq.identity', JSON.stringify(mockOrganizerIdentity));

    render(
      <MemoryRouter initialEntries={['/organizer/organization']}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: /Organization Profile/i })).toBeDefined();
  });

  it('renders tournament announcements communication console', async () => {
    window.localStorage.setItem('evoq.token', mockOrganizerIdentity.token);
    window.localStorage.setItem('evoq.identity', JSON.stringify(mockOrganizerIdentity));

    render(
      <MemoryRouter initialEntries={['/organizer/tournaments/1/announcements']}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: /Announcements/i })).toBeDefined();
  });

  it('renders tournament completion and archive finalization page', async () => {
    window.localStorage.setItem('evoq.token', mockOrganizerIdentity.token);
    window.localStorage.setItem('evoq.identity', JSON.stringify(mockOrganizerIdentity));

    render(
      <MemoryRouter initialEntries={['/organizer/tournaments/1/complete']}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: /Complete tournament/i })).toBeDefined();
  });

  it('renders tournament scout and staff access delegation console', async () => {
    window.localStorage.setItem('evoq.token', mockOrganizerIdentity.token);
    window.localStorage.setItem('evoq.identity', JSON.stringify(mockOrganizerIdentity));

    render(
      <MemoryRouter initialEntries={['/organizer/scouts']}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: /Tournament Scouts & Staff/i })).toBeDefined();
  });
});
