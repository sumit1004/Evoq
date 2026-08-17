import { Outlet, useLocation } from 'react-router-dom';
import { LandingNavbar } from '../components/landing/LandingNavbar.jsx';
import { GlobalNavbar } from '../components/GlobalNavbar.jsx';

export function PublicLayout() {
  const location = useLocation();
  if (location.pathname === '/') return <div className="public-shell landing-shell"><LandingNavbar /><Outlet /></div>;
  return (
    <div className="public-shell">
      <GlobalNavbar />
      <main className="public-main">
        <Outlet />
      </main>
    </div>
  );
}
