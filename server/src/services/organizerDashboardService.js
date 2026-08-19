import { getCurrentIdentity } from './identityService.js';
import * as repository from '../repositories/organizerDashboardRepository.js';

export async function getOrganizerDashboard(userId) {
  const [
    user,
    metrics,
    actionRequired,
    tournaments,
    upcomingDeadlines,
    liveOperations,
    notifications
  ] = await Promise.all([
    getCurrentIdentity(userId),
    repository.getMetrics(userId),
    repository.getActionRequired(userId),
    repository.listMyTournaments(userId),
    repository.listUpcomingDeadlines(userId),
    repository.getLiveOperations(userId),
    import('../repositories/communicationRepository.js').then((module) => module.listNotifications(userId))
  ]);

  return {
    user,
    metrics: {
      active: Number(metrics.active || 0),
      live: Number(metrics.live || 0),
      upcoming: Number(metrics.upcoming || 0),
      completed: Number(metrics.completed || 0),
      pendingReviews: Number(metrics.pending_reviews || 0),
      totalTeams: Number(metrics.total_teams || 0)
    },
    actionRequired: {
      pendingRegistrations: actionRequired.pendingRegs.map(r => ({
        tournamentId: r.tournament_id,
        tournamentName: r.tournament_name,
        count: Number(r.pending_count)
      })),
      pendingGroups: actionRequired.pendingGroups.map(g => ({
        groupId: g.group_id,
        groupName: g.group_name,
        roundId: g.round_id,
        roundName: g.round_name,
        tournamentId: g.tournament_id,
        tournamentName: g.tournament_name
      }))
    },
    tournaments: tournaments.map(t => ({
      id: t.id,
      name: t.name,
      status: t.status,
      tournamentDate: t.tournament_date,
      registrationEndAt: t.registration_end_at,
      totalRegistrations: Number(t.total_registrations || 0),
      verifiedRegistrations: Number(t.verified_registrations || 0),
      pendingRegistrations: Number(t.pending_registrations || 0),
      currentRound: t.current_round,
      currentGroups: Number(t.current_groups || 0)
    })),
    upcomingDeadlines: upcomingDeadlines.map(d => ({
      type: d.type,
      tournamentId: d.tournament_id,
      tournamentName: d.tournament_name,
      date: d.date
    })),
    liveOperations: liveOperations.map(l => ({
      tournamentId: l.tournament_id,
      tournamentName: l.tournament_name,
      roundName: l.round_name,
      activeGroups: Number(l.active_groups || 0),
      verifiedPlayers: Number(l.verified_players || 0),
      completedMatches: Number(l.completed_matches || 0),
      liveMatches: Number(l.live_matches || 0),
      pendingMatches: Number(l.pending_matches || 0)
    })),
    recentActivity: notifications.slice(0, 5).map(n => ({
      id: n.id,
      tournamentId: n.tournament_id,
      type: n.type,
      content: n.content,
      createdAt: n.created_at
    })),
    unreadNotifications: notifications.filter(n => !n.read_at).length
  };
}
