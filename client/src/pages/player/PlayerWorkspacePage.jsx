import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { WorkspaceShell } from '../../components/WorkspaceShell.jsx';
import { PlayerDashboardPage } from './PlayerDashboardPage.jsx';
import { getPlayerNavigation } from '../../config/workspaceNavigation.js';

export function PlayerWorkspacePage() {
  const { identity, loading } = useAuth();
  if (loading) return <div className="route-loading" role="status">Restoring your EVOQ session...</div>;
  if (!identity) return <Navigate to="/login" replace />;
  if (identity.role !== 'PLAYER') return <Navigate to="/organizer" replace />;
  return <WorkspaceShell label="Player workspace" items={getPlayerNavigation()}><Outlet /></WorkspaceShell>;
}

export function PlayerOverviewPage() { return <PlayerDashboardPage />; }
