import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { WorkspaceShell } from '../components/WorkspaceShell.jsx';
import { getOrganizerNavigation, getPlayerNavigation } from '../config/workspaceNavigation.js';

export function AuthenticatedLayout() {
  const { identity, loading } = useAuth();
  const params = useParams();
  if (loading) return <div className="route-loading" role="status">Restoring your EVOQ session...</div>;
  if (!identity) return <Navigate to="/login" replace />;
  const organizer = identity.role === 'ORGANIZER';
  const items = organizer ? getOrganizerNavigation(params) : getPlayerNavigation();
  return <WorkspaceShell label={organizer ? 'Organizer workspace' : 'Player workspace'} items={items}><Outlet /></WorkspaceShell>;
}
