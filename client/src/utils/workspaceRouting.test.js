import { describe, expect, it } from 'vitest';
import { resolveInitialWorkspaceRoute, hasActiveScoutRole } from './workspaceRouting.js';

describe('workspaceRouting utility', () => {
  it('redirects unauthenticated users to login', () => {
    expect(resolveInitialWorkspaceRoute(null)).toBe('/login');
    expect(resolveInitialWorkspaceRoute(undefined)).toBe('/login');
  });

  it('redirects organizers to /organizer', () => {
    expect(resolveInitialWorkspaceRoute({ id: 1, role: 'ORGANIZER' })).toBe('/organizer');
    expect(resolveInitialWorkspaceRoute({ id: 1, role: 'ORGANIZER', isScout: true })).toBe('/organizer');
  });

  it('redirects players with active scout assignments to /scout', () => {
    expect(resolveInitialWorkspaceRoute({ id: 2, role: 'PLAYER', isScout: true, scoutCount: 1 })).toBe('/scout');
    expect(
      resolveInitialWorkspaceRoute({
        id: 2,
        role: 'PLAYER',
        isScout: false,
        scoutAssignments: [{ id: 1, tournamentId: 4, status: 'ACTIVE' }],
      })
    ).toBe('/scout');
  });

  it('redirects standard players without scout assignments to /player/dashboard', () => {
    expect(resolveInitialWorkspaceRoute({ id: 3, role: 'PLAYER', isScout: false, scoutCount: 0, scoutAssignments: [] })).toBe(
      '/player/dashboard'
    );
  });

  it('correctly identifies active scout capability with hasActiveScoutRole', () => {
    expect(hasActiveScoutRole(null)).toBe(false);
    expect(hasActiveScoutRole({ role: 'PLAYER' })).toBe(false);
    expect(hasActiveScoutRole({ role: 'PLAYER', isScout: true })).toBe(true);
    expect(hasActiveScoutRole({ role: 'PLAYER', scoutCount: 2 })).toBe(true);
    expect(hasActiveScoutRole({ role: 'PLAYER', scoutAssignments: [{ id: 10 }] })).toBe(true);
  });
});
