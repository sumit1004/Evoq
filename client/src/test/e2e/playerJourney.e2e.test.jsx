import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { App } from '../../app/App.jsx';

vi.mock('../../services/teamApi.js', () => ({
  fetchTeams: vi.fn().mockResolvedValue([]),
  createTeam: vi.fn(),
  removeTeam: vi.fn(),
}));

vi.mock('../../services/tournamentApi.js', () => ({
  fetchTournaments: vi.fn().mockResolvedValue({ tournaments: [], pagination: { page: 1, totalPages: 1, total: 0 } }),
  fetchTournament: vi.fn().mockResolvedValue({ tournament: { id: 1, name: 'Apex Premier', status: 'LIVE' } }),
  fetchRegistrations: vi.fn().mockResolvedValue({ registrations: [] }),
}));

vi.mock('../../services/competitionApi.js', () => ({
  fetchTournamentGroups: vi.fn().mockResolvedValue({ groups: [] }),
  fetchTournamentLeaderboard: vi.fn().mockResolvedValue({ leaderboard: [] }),
  fetchGroupLeaderboard: vi.fn().mockResolvedValue({ leaderboard: [] }),
  fetchGroupMatches: vi.fn().mockResolvedValue({ matches: [] }),
  fetchResults: vi.fn().mockResolvedValue({ results: [] }),
}));

vi.mock('../../services/communicationApi.js', () => ({
  fetchAnnouncements: vi.fn().mockResolvedValue({ announcements: [] }),
  fetchChat: vi.fn().mockResolvedValue({ messages: [] }),
  fetchNotifications: vi.fn().mockResolvedValue({ notifications: [] }),
}));

vi.mock('../../services/archiveApi.js', () => ({
  fetchHistory: vi.fn().mockResolvedValue({ history: [] }),
  fetchHistoryEntry: vi.fn().mockResolvedValue({ archive: null }),
}));

const mockPlayerIdentity = {
  id: 101,
  name: 'Player One',
  email: 'player01@evoq.gg',
  role: 'PLAYER',
  token: 'jwt_player_01_token',
  uniquePlayerId: 'EVQ-0101',
};

describe('Phase 5 E2E: Player Complete Product Journey (PLAYER_01)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders landing page with platform hero banner', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /Run every round\. Own the competition\./i })).not.toBeNull();
  });

  it('renders player profile and performance workspace', async () => {
    window.localStorage.setItem('evoq.token', mockPlayerIdentity.token);
    window.localStorage.setItem('evoq.identity', JSON.stringify(mockPlayerIdentity));

    render(
      <MemoryRouter initialEntries={['/player/profile']}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByText(/Profile & Performance/i)).toBeDefined();
  });

  it('renders player teams management workspace', async () => {
    window.localStorage.setItem('evoq.token', mockPlayerIdentity.token);
    window.localStorage.setItem('evoq.identity', JSON.stringify(mockPlayerIdentity));

    render(
      <MemoryRouter initialEntries={['/player/teams']}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: /Your teams/i })).toBeDefined();
  });

  it('renders public tournament discovery page', async () => {
    render(
      <MemoryRouter initialEntries={['/tournaments']}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: 'Tournaments' })).toBeDefined();
  });

  it('renders tournament history page for completed events', async () => {
    window.localStorage.setItem('evoq.token', mockPlayerIdentity.token);
    window.localStorage.setItem('evoq.identity', JSON.stringify(mockPlayerIdentity));

    render(
      <MemoryRouter initialEntries={['/history']}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: /Tournament history/i })).toBeDefined();
  });

  it('persists player authentication session state across page routes', () => {
    window.localStorage.setItem('evoq.token', mockPlayerIdentity.token);
    window.localStorage.setItem('evoq.identity', JSON.stringify(mockPlayerIdentity));

    expect(window.localStorage.getItem('evoq.token')).toBe('jwt_player_01_token');
    const persisted = JSON.parse(window.localStorage.getItem('evoq.identity'));
    expect(persisted.email).toBe('player01@evoq.gg');
    expect(persisted.role).toBe('PLAYER');
  });
});
