import { useEffect, useState } from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { WorkspaceShell } from '../../components/WorkspaceShell.jsx';
import { getOrganizerNavigation } from '../../config/workspaceNavigation.js';
import { hasActiveScoutRole } from '../../utils/workspaceRouting.js';
import { fetchTournamentAccess } from '../../services/tournamentApi.js';

export function OrganizerWorkspacePage() {
  const { identity, loading } = useAuth();
  const { tournamentId, roundId, matchId, groupId } = useParams();
  const [effectiveAccess, setEffectiveAccess] = useState(null);

  const isScout = identity?.role !== 'ORGANIZER';

  useEffect(() => {
    if (tournamentId && identity) {
      fetchTournamentAccess(tournamentId)
        .then((data) => setEffectiveAccess(data?.access || null))
        .catch(() => setEffectiveAccess(null));
    } else {
      setEffectiveAccess(null);
    }
  }, [tournamentId, identity]);

  if (loading) return <div className="route-loading" role="status">Restoring your EVOQ session...</div>;
  if (!identity) return <Navigate to="/login" replace />;

  const hasStaffAccess = identity.role === 'ORGANIZER' || hasActiveScoutRole(identity);
  if (!hasStaffAccess) return <Navigate to="/player/dashboard" replace />;

  const label = isScout ? 'Scout Console' : 'Organizer workspace';
  const navItems = getOrganizerNavigation({
    tournamentId,
    roundId,
    matchId,
    groupId,
    isScout,
    effectiveAccess,
  });

  return (
    <WorkspaceShell label={label} items={navItems}>
      <Outlet context={{ effectiveAccess, isScout }} />
    </WorkspaceShell>
  );
}


