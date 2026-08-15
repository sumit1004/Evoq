import { NavLink, Outlet } from 'react-router-dom';

export function PublicLayout() {
  return (
    <div className="public-shell">
      <header className="public-header">
        <NavLink className="brand" to="/">
          EVOQ
        </NavLink>
        <nav className="public-nav" aria-label="Public navigation">
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
