import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { App } from '../../app/App.jsx';

vi.mock('../../services/scoutApi.js', () => ({
  fetchScoutAssignedTournaments: vi.fn().mockResolvedValue({ assignments: [{ id: 10, tournamentId: 1, tournamentName: 'Valorant Cup', status: 'ACTIVE' }] }),
  fetchScoutTournamentWorkspace: vi.fn().mockResolvedValue({ tournamentName: 'Valorant Cup', groups: [] }),
}));

describe('Phase 5 E2E: Scout Workspace & Permission Enforcements (SCOUT_01)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('verifies scout lands on assigned tournaments scout console workspace', async () => {
    const scoutIdentity = {
      id: 301,
      name: 'Scout One',
      email: 'scout01@evoq.gg',
      role: 'PLAYER',
      isScout: true,
      scoutCount: 1,
      scoutAssignments: [{ id: 10, tournamentId: 1, tournamentName: 'Valorant Cup', status: 'ACTIVE' }],
      token: 'jwt_scout_01_token',
    };

    window.localStorage.setItem('evoq.token', scoutIdentity.token);
    window.localStorage.setItem('evoq.identity', JSON.stringify(scoutIdentity));

    // Scout accesses /scout
    const scoutConsole = render(
      <MemoryRouter initialEntries={['/scout']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Assigned Tournaments/i })).toBeDefined();
    expect(screen.queryByRole('heading', { name: /Player Dashboard/i })).toBeNull();
    scoutConsole.unmount();

    // Scout accesses specific assigned tournament console
    const scoutTourney = render(
      <MemoryRouter initialEntries={['/scout/tournaments/1']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getAllByText(/Scout/i).length).toBeGreaterThan(0);
    scoutTourney.unmount();
  });
});
