export function getPlayerNavigation() {
  return [
    { label: 'Overview', to: '/player/dashboard', active: (path) => path === '/player' || path === '/player/dashboard' },
    { label: 'Teams', to: '/player/teams', active: (path) => path.startsWith('/player/teams') },
    { label: 'Tournaments', to: '/tournaments', active: (path) => path === '/tournaments' || path.startsWith('/tournaments/') || path === '/player/my-tournaments' || path.startsWith('/player/communications') || path.startsWith('/player/groups') },
    { label: 'Notifications', notification: true },
    { label: 'History', to: '/history', active: (path) => path.startsWith('/history') },
  ];
}

export function getOrganizerNavigation({ tournamentId, isScout = false, effectiveAccess = null } = {}) {
  const permissions = new Set(effectiveAccess?.permissions || []);
  const allowed = effectiveAccess?.allowedModules || {};

  const items = [
    { label: 'Overview', to: '/organizer', active: (path) => path === '/organizer' },
    { label: 'Tournaments', to: '/organizer/tournaments', active: (path) => path.startsWith('/organizer/tournaments') || (path.startsWith('/tournaments/') && !path.includes('/scout/')) },
  ];

  if (tournamentId) {
    items.push({
      label: 'Tournament Hub',
      to: `/organizer/tournaments/${tournamentId}`,
      active: (path) => path === `/organizer/tournaments/${tournamentId}`
    });

    const canViewReg = !isScout || allowed.registrations || permissions.has('VIEW_REGISTRATIONS');
    items.push({
      label: 'Registrations',
      to: `/organizer/tournaments/${tournamentId}/registrations`,
      active: (path) => path.includes('/registrations'),
      locked: isScout && !canViewReg,
    });

    const canViewAnnounce = !isScout || allowed.announcements || permissions.has('VIEW_ANNOUNCEMENTS');
    items.push({
      label: 'Announcements',
      to: `/organizer/tournaments/${tournamentId}/announcements`,
      active: (path) => path.includes('/announcements'),
      locked: isScout && !canViewAnnounce,
    });

    if (!isScout) {
      items.push({
        label: 'Complete tournament',
        to: `/organizer/tournaments/${tournamentId}/complete`,
        active: (path) => path.includes('/complete')
      });
    }
  }

  if (!isScout) {
    items.push({
      label: 'Scouts',
      to: '/organizer/scouts',
      active: (path) => path.startsWith('/organizer/scouts')
    });
  }

  if (!isScout) {
    items.push(
      { label: 'Notifications', notification: true },
      { label: 'History', to: '/history', active: (path) => path.startsWith('/history') }
    );
  }

  return items;
}

export function getScoutNavigation({ tournamentId } = {}) {
  return [
    { label: 'Overview', to: '/scout', active: (path) => path === '/scout' || path === '/scout/tournaments' },
    ...(tournamentId ? [
      { label: 'Scout Console', to: `/scout/tournaments/${tournamentId}`, active: (path) => path.startsWith(`/scout/tournaments/${tournamentId}`) },
    ] : []),
  ];
}


