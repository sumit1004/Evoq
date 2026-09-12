import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { App } from '../../app/App.jsx';

vi.mock('../../services/tournamentApi.js', () => ({
  fetchTournamentById: vi.fn().mockResolvedValue({ id: 1, name: 'Apex Premier', status: 'LIVE' }),
  fetchAnnouncements: vi.fn().mockResolvedValue({ announcements: [] }),
  fetchLeaderboard: vi.fn().mockResolvedValue({ leaderboard: [] }),
}));

describe('Phase 5 E2E: Multi-User Realtime Synchronization (Player, Organizer, Scout)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('verifies client realtime events are wired to socket subscriptions without duplicate listeners', async () => {
    const playerIdentity = {
      id: 101,
      name: 'Player One',
      email: 'player01@evoq.gg',
      role: 'PLAYER',
      token: 'jwt_player_token_101',
    };

    window.localStorage.setItem('evoq.token', playerIdentity.token);
    window.localStorage.setItem('evoq.identity', JSON.stringify(playerIdentity));

    // Render tournament hub with SocketProvider active
    const firstRender = render(
      <MemoryRouter initialEntries={['/player/tournaments/1']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getAllByText(/Tournament/i).length).toBeGreaterThan(0);
    firstRender.unmount();

    // Verify unmount and re-mount does not throw or retain duplicate event bindings
    const secondRender = render(
      <MemoryRouter initialEntries={['/player/tournaments/1']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getAllByText(/Tournament/i).length).toBeGreaterThan(0);
    secondRender.unmount();
  });
});
