export function getPlayerNavigation() {
  return [
    { label: 'Overview', to: '/player/dashboard', active: (path) => path === '/player' || path === '/player/dashboard' },
    { label: 'Teams', to: '/player/teams', active: (path) => path.startsWith('/player/teams') },
    { label: 'Tournaments', to: '/tournaments', active: (path) => path === '/tournaments' || path.startsWith('/tournaments/') || path === '/player/my-tournaments' || path.startsWith('/player/communications') || path.startsWith('/player/groups') },
    { label: 'Notifications', notification: true },
    { label: 'History', to: '/history', active: (path) => path.startsWith('/history') },
  ];
}

export function getOrganizerNavigation({ tournamentId } = {}) {
  return [
    { label: 'Overview', to: '/organizer', active: (path) => path === '/organizer' },
    { label: 'Tournaments', to: '/organizer/tournaments', active: (path) => path.startsWith('/organizer/tournaments') || path === '/tournaments' || path.startsWith('/tournaments/') },
    ...(tournamentId ? [
      { label: 'Tournament Hub', to: `/organizer/tournaments/${tournamentId}`, active: (path) => path === `/organizer/tournaments/${tournamentId}` },
      { label: 'Registrations', to: `/organizer/tournaments/${tournamentId}/registrations`, active: (path) => path.includes('/registrations') },
      { label: 'Announcements', to: `/organizer/tournaments/${tournamentId}/announcements`, active: (path) => path.includes('/announcements') },
      { label: 'Complete tournament', to: `/organizer/tournaments/${tournamentId}/complete`, active: (path) => path.includes('/complete') },
    ] : []),
    { label: 'Notifications', notification: true },
    { label: 'History', to: '/history', active: (path) => path.startsWith('/history') },
  ];
}
