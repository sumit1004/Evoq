import { Link, Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { NotificationBell } from '../../components/NotificationBell.jsx';

export function OrganizerWorkspacePage() {
  const { identity, logout } = useAuth();
  const location = useLocation();
  const { tournamentId, roundId, matchId, groupId } = useParams();
  if (!identity) return <Navigate to="/login" replace />;
  if (identity.role !== 'ORGANIZER') return <Navigate to="/player" replace />;
  return (
    <div className="workspace-shell">
      <header className="workspace-header"><Link className="brand" to="/">EVOQ</Link><div className="workspace-user"><NotificationBell /><span>{identity.name}</span><button className="text-button" type="button" onClick={logout}>Logout</button></div></header>
      <div className="workspace-body">
        <aside className="workspace-sidebar" aria-label="Organizer navigation">
          <div className="workspace-label">Organizer workspace</div>
          <Link className={location.pathname === '/organizer' ? 'workspace-link active' : 'workspace-link'} to="/organizer">Overview</Link>
          <Link className={location.pathname.startsWith('/organizer/tournaments') ? 'workspace-link active' : 'workspace-link'} to="/organizer/tournaments">Tournaments</Link>
          {tournamentId && <Link className={location.pathname.includes('/registrations') ? 'workspace-link active' : 'workspace-link'} to={`/organizer/tournaments/${tournamentId}/registrations`}>Registrations</Link>}
          {tournamentId && <Link className={location.pathname.includes('/rounds') || location.pathname.includes('/groups') ? 'workspace-link active' : 'workspace-link'} to={`/organizer/tournaments/${tournamentId}/rounds`}>Competition setup</Link>}
          {roundId && <Link className={location.pathname.includes('/qualifications') ? 'workspace-link active' : 'workspace-link'} to={`/organizer/tournaments/${tournamentId}/rounds/${roundId}/qualifications`}>Qualifications</Link>}
          {matchId && <Link className={location.pathname.includes('/matches/') ? 'workspace-link active' : 'workspace-link'} to={`/organizer/tournaments/${tournamentId}/matches/${matchId}`}>Match results</Link>}
          {tournamentId && <Link className="workspace-link" to={`/organizer/tournaments/${tournamentId}/announcements`}>Announcements</Link>}
          {groupId && <Link className="workspace-link" to={`/organizer/tournaments/${tournamentId}/groups/${groupId}/chat`}>Group chat</Link>}
          {tournamentId && <Link className="workspace-link" to={`/organizer/tournaments/${tournamentId}/complete`}>Complete tournament</Link>}
          <Link className={location.pathname.startsWith('/history') ? 'workspace-link active' : 'workspace-link'} to="/history">History</Link>
        </aside>
        <main className="workspace-main"><Outlet /></main>
      </div>
    </div>
  );
}

export function OrganizerOverviewPage() {
  return <section className="page-section workspace-page"><div className="page-kicker">Operations</div><h1>Organizer console</h1><p>Create tournaments, manage registration windows, and review participant submissions.</p><Link className="button primary-button" to="/organizer/tournaments">Manage tournaments</Link></section>;
}
