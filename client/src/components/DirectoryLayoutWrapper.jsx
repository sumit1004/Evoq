import { useAuth } from '../context/AuthContext.jsx';
import { WorkspaceShell } from './WorkspaceShell.jsx';
import { getPlayerNavigation, getOrganizerNavigation } from '../config/workspaceNavigation.js';
import { GlobalNavbar } from './GlobalNavbar.jsx';

export function DirectoryLayoutWrapper({ children }) {
  const { identity, loading } = useAuth();

  if (loading) {
    return (
      <div className="route-loading" role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontSize: '18px', color: '#91a0b3' }}>
        Restoring your EVOQ session...
      </div>
    );
  }

  if (!identity) {
    // Guest Layout
    return (
      <div className="public-shell">
        <GlobalNavbar />
        <main className="public-main">
          {children}
        </main>
      </div>
    );
  }

  if (identity.role === 'ORGANIZER') {
    return (
      <WorkspaceShell label="Organizer workspace" items={getOrganizerNavigation()}>
        <div style={{ padding: '24px' }}>
          {children}
        </div>
      </WorkspaceShell>
    );
  }

  // PLAYER Layout
  return (
    <WorkspaceShell label="Player workspace" items={getPlayerNavigation()}>
      <div style={{ padding: '24px' }}>
        {children}
      </div>
    </WorkspaceShell>
  );
}
