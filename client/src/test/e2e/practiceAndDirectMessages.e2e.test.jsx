import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { App } from '../../app/App.jsx';

vi.mock('../../services/directMessageApi.js', () => ({
  fetchConversations: vi.fn().mockResolvedValue({ conversations: [] }),
  fetchDirectMessages: vi.fn().mockResolvedValue({ messages: [] }),
}));

vi.mock('../../services/playerProfileApi.js', () => ({
  searchPlayers: vi.fn().mockResolvedValue([]),
  fetchPlayerProfile: vi.fn().mockResolvedValue({ player: { id: 101, name: 'Player One', uniquePlayerId: 'EVQ-0101' } }),
}));

vi.mock('../../services/organizationApi.js', () => ({
  fetchOrganizations: vi.fn().mockResolvedValue({ organizations: [] }),
}));

describe('Phase 5 E2E: Practice Scrims, Direct Messaging & Public Profiles', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders direct messages workspace, public player search, and public profiles', async () => {
    const playerIdentity = {
      id: 101,
      name: 'Player One',
      email: 'player01@evoq.gg',
      role: 'PLAYER',
      token: 'jwt_player_token_101',
      uniquePlayerId: 'EVQ-0101',
    };

    window.localStorage.setItem('evoq.token', playerIdentity.token);
    window.localStorage.setItem('evoq.identity', JSON.stringify(playerIdentity));

    // 1. Direct Messaging Workspace
    const messages = render(
      <MemoryRouter initialEntries={['/player/messages']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /Messages/i })).toBeDefined();
    messages.unmount();

    // 2. Find Player by EVOQ ID Search
    const search = render(
      <MemoryRouter initialEntries={['/player/search']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /Find Esports Players/i })).toBeDefined();
    search.unmount();

    // 3. Public Player Profile Lookup
    const playerLookup = render(
      <MemoryRouter initialEntries={['/player/EVQ-0101']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getAllByText(/Find Player/i).length).toBeGreaterThan(0);
    playerLookup.unmount();

    // 4. Public Organizations Directory
    const orgs = render(
      <MemoryRouter initialEntries={['/organizations']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getAllByText(/Organizations/i).length).toBeGreaterThan(0);
    orgs.unmount();
  });
});
