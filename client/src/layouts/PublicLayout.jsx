import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LandingNavbar } from '../components/landing/LandingNavbar.jsx';

export function PublicLayout() {
  const location = useLocation();
  if (location.pathname === '/') return <div className="public-shell landing-shell"><LandingNavbar /><Outlet /></div>;
  return (
    <div className="public-shell">
      <header className="public-header">
        <NavLink className="brand" to="/">
          EVOQ
        </NavLink>
        <nav className="public-nav" aria-label="Public navigation">
          <NavLink to="/tournaments">Tournaments</NavLink>
          <NavLink to="/login">Login</NavLink>
          <NavLink to="/signup">Signup</NavLink>
        </nav>
      </header>
      <main className="public-main">
        <Outlet />
      </main>
    </div>
  );
}
