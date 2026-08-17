export function getPlayerNavigation() {
  return [
    { label: 'Overview', to: '/player/dashboard', active: (path) => path === '/player' || path === '/player/dashboard' },
    { label: 'Teams', to: '/player/teams', active: (path) => path.startsWith('/player/teams') },
    { label: 'Tournaments', to: '/player/my-tournaments', active: (path) => path === '/player/my-tournaments' || path.startsWith('/player/communications') || path.startsWith('/player/groups') },
    { label: 'Notifications', notification: true },
    { label: 'History', to: '/history', active: (path) => path.startsWith('/history') },
  ];
}

export function getOrganizerNavigation({ tournamentId, roundId, matchId, groupId } = {}) {
  return [
    { label: 'Overview', to: '/organizer', active: (path) => path === '/organizer' },
    { label: 'Tournaments', to: '/organizer/tournaments', active: (path) => path.startsWith('/organizer/tournaments') },
    ...(tournamentId ? [
      { label: 'Registrations', to: `/organizer/tournaments/${tournamentId}/registrations`, active: (path) => path.includes('/registrations') },
      { label: 'Competition setup', to: `/organizer/tournaments/${tournamentId}/rounds`, active: (path) => path.includes('/rounds') || path.includes('/groups') },
      ...(roundId ? [{ label: 'Qualifications', to: `/organizer/tournaments/${tournamentId}/rounds/${roundId}/qualifications`, active: (path) => path.includes('/qualifications') }] : []),
      ...(matchId ? [{ label: 'Match results', to: `/organizer/tournaments/${tournamentId}/matches/${matchId}`, active: (path) => path.includes('/matches/') }] : []),
      { label: 'Announcements', to: `/organizer/tournaments/${tournamentId}/announcements`, active: (path) => path.includes('/announcements') },
      ...(groupId ? [{ label: 'Group chat', to: `/organizer/tournaments/${tournamentId}/groups/${groupId}/chat`, active: (path) => path.includes('/chat') }] : []),
      { label: 'Complete tournament', to: `/organizer/tournaments/${tournamentId}/complete`, active: (path) => path.includes('/complete') },
    ] : []),
    { label: 'Notifications', notification: true },
    { label: 'History', to: '/history', active: (path) => path.startsWith('/history') },
  ];
}
