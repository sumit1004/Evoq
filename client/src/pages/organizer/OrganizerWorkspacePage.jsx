import { Link, Navigate, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { WorkspaceShell } from '../../components/WorkspaceShell.jsx';
import { getOrganizerNavigation } from '../../config/workspaceNavigation.js';

export function OrganizerWorkspacePage() {
  const { identity, loading } = useAuth();
  const { tournamentId, roundId, matchId, groupId } = useParams();
  if (loading) return <div className="route-loading" role="status">Restoring your EVOQ session...</div>;
  if (!identity) return <Navigate to="/login" replace />;
  if (identity.role !== 'ORGANIZER') return <Navigate to="/player" replace />;
  return <WorkspaceShell label="Organizer workspace" items={getOrganizerNavigation({ tournamentId, roundId, matchId, groupId })}><Outlet /></WorkspaceShell>;
}

export function OrganizerOverviewPage() {
  return <section className="page-section workspace-page"><div className="page-kicker">Operations</div><h1>Organizer console</h1><p>Create tournaments, manage registration windows, and review participant submissions.</p><Link className="button primary-button" to="/organizer/tournaments">Manage tournaments</Link></section>;
}
