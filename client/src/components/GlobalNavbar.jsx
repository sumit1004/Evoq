import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { resolveInitialWorkspaceRoute, hasActiveScoutRole } from '../utils/workspaceRouting.js';

export function GlobalNavbar() {
  const { identity, loading } = useAuth();
  const home = resolveInitialWorkspaceRoute(identity);
  const isScout = hasActiveScoutRole(identity);

  const getDashboardLabel = () => {
    if (identity?.role === 'ORGANIZER') return 'Organizer console';
    if (isScout) return 'Scout console';
    return 'My dashboard';
  };

  return (
    <header className="global-navbar">
      <Link className="brand" to={identity ? home : '/'}>
        EVOQ
      </Link>
      {!loading && (
        <nav className="global-nav" aria-label="Public navigation">
          <NavLink to="/tournaments">Tournaments</NavLink>
          {identity ? (
            <Link className="global-nav-app-link" to={home}>
              {getDashboardLabel()} →
            </Link>
          ) : (
            <>
              <NavLink to="/login">Login</NavLink>
              <NavLink to="/signup">Sign up</NavLink>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
