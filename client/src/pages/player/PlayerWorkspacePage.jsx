import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { NotificationBell } from '../../components/NotificationBell.jsx';

export function PlayerWorkspacePage() {
  const { identity, logout } = useAuth();
  const location = useLocation();
  if (!identity) return <Navigate to="/login" replace />;
  if (identity.role !== 'PLAYER') return <Navigate to="/organizer" replace />;

  return (
    <div className="workspace-shell">
      <header className="workspace-header">
        <Link className="brand" to="/">EVOQ</Link>
        <div className="workspace-user"><NotificationBell />
          <span>{identity.name}</span>
          <button className="text-button" type="button" onClick={logout}>Logout</button>
        </div>
      </header>
      <div className="workspace-body">
        <aside className="workspace-sidebar" aria-label="Player navigation">
          <div className="workspace-label">Player workspace</div>
          <Link className={location.pathname === '/player' ? 'workspace-link active' : 'workspace-link'} to="/player">Overview</Link>
          <Link className={location.pathname.startsWith('/player/teams') ? 'workspace-link active' : 'workspace-link'} to="/player/teams">Teams</Link>
          <span className="workspace-link disabled">Tournaments</span>
          <Link className={location.pathname.startsWith('/history') ? 'workspace-link active' : 'workspace-link'} to="/history">History</Link>
        </aside>
        <main className="workspace-main"><Outlet /></main>
      </div>
    </div>
  );
}

export function PlayerOverviewPage() {
  const { identity } = useAuth();
  return (
    <section className="page-section workspace-page">
      <div className="page-kicker">Player workspace</div>
      <h1>Welcome, {identity.name}</h1>
      <p>Manage your reusable teams and prepare for tournament registration.</p>
      <Link className="button primary-button" to="/player/teams">Open teams</Link>
    </section>
  );
}
