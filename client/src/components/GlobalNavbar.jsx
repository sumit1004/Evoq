import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function GlobalNavbar() {
  const { identity, loading } = useAuth();
  const home = identity?.role === 'ORGANIZER' ? '/organizer' : '/player/dashboard';

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
              {identity.role === 'ORGANIZER' ? 'Organizer console' : 'My dashboard'} →
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
