import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export function AuthenticatedBoundaryPage({ area }) {
  const { identity, logout } = useAuth();
  if (!identity) return <Navigate to="/login" replace />;
  const expectedRole = area === 'organizer' ? 'ORGANIZER' : 'PLAYER';
  if (identity.role !== expectedRole) return <Navigate to={identity.role === 'ORGANIZER' ? '/organizer' : '/player'} replace />;
  return (
    <section className="page-section narrow account-boundary">
      <div className="page-kicker">{area} workspace</div>
      <h1>Account ready</h1>
      <p>Welcome, {identity.name}. The {area} application will be connected in a later EVOQ phase.</p>
      {identity.profile?.uniquePlayerId && <p className="status-panel">Player ID: {identity.profile.uniquePlayerId}</p>}
      <div className="boundary-actions">
        <Link className="button secondary-button" to="/">Return home</Link>
        <button className="button ghost-button" type="button" onClick={logout}>Logout</button>
      </div>
    </section>
  );
}
