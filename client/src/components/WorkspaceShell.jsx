import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { NotificationNavItem } from './NotificationNavItem.jsx';

const NAV_ICONS = {
  Overview: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"></rect>
      <rect x="14" y="3" width="7" height="7"></rect>
      <rect x="14" y="14" width="7" height="7"></rect>
      <rect x="3" y="14" width="7" height="7"></rect>
    </svg>
  ),
  Teams: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  ),
  Tournaments: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
      <path d="M4 22h16"></path>
      <path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34c3.42-.72 6-3.76 6-7.39V2H4v7.27c0 3.63 2.58 6.67 6 7.39z"></path>
    </svg>
  ),
  'Tournament Hub': (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
  ),
  Registrations: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
      <path d="M9 14l2 2 4-4"></path>
    </svg>
  ),
  Announcements: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>
  ),
  Notifications: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>
  ),
  History: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  ),
  'Complete tournament': (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  ),
};

function WorkspaceLink({ item, onNavigate }) {
  const location = useLocation();
  const active = item.active ? item.active(location.pathname) : location.pathname === item.to;
  const icon = NAV_ICONS[item.label] || null;

  return (
    <Link
      className={`workspace-link${active ? ' active' : ''}`}
      to={item.to}
      onClick={onNavigate}
      title={item.label}
    >
      {icon && <span className="workspace-link-icon">{icon}</span>}
      <span className="workspace-link-text">{item.label}</span>
    </Link>
  );
}

export function WorkspaceShell({ label, items, children }) {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const { identity, logout } = useAuth();
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', close);
    document.body.classList.add('drawer-open');
    return () => {
      document.removeEventListener('keydown', close);
      document.body.classList.remove('drawer-open');
    };
  }, [open]);

  const close = () => setOpen(false);
  const toggle = () => setOpen((value) => !value);

  const userInitial = identity?.name ? identity.name.charAt(0).toUpperCase() : 'U';
  const roleLabel = identity?.role === 'ORGANIZER' ? 'ORGANIZER' : 'PLAYER';
  const homeLink = identity?.role === 'ORGANIZER' ? '/organizer' : '/player/dashboard';

  return (
    <div className="workspace-shell">
      {/* Mobile Top Bar */}
      <div className="workspace-mobile-bar">
        <button
          ref={menuButtonRef}
          className="menu-button"
          type="button"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          aria-controls="workspace-sidebar"
          onClick={toggle}
        >
          <span className={open ? 'menu-bars is-open' : 'menu-bars'} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>
        <Link className="brand" to={homeLink}>
          EVOQ
        </Link>
      </div>

      <div className="workspace-layout">
        {open && <button className="drawer-backdrop" aria-label="Close navigation" type="button" onClick={close} />}

        {/* Sidebar */}
        <aside id="workspace-sidebar" className={`workspace-sidebar${open ? ' is-open' : ''}`} aria-label={`${label} navigation`}>
          {/* Brand & Mobile Close */}
          <div className="workspace-sidebar-brand">
            <Link className="brand" to={homeLink} onClick={close}>
              EVOQ
            </Link>
            <button className="drawer-close" aria-label="Close navigation" type="button" onClick={close}>
              ×
            </button>
          </div>

          {/* User Identity Profile Card */}
          <div className="workspace-identity">
            <div className="workspace-avatar" aria-hidden="true">
              {userInitial}
            </div>
            <div className="workspace-user-info">
              <strong title={identity?.name}>{identity?.name || 'User'}</strong>
              <span className="workspace-role-pill">{roleLabel}</span>
            </div>
          </div>

          {/* Workspace Menu Section */}
          <div className="workspace-sidebar-head">
            <div className="workspace-label">Navigation</div>
          </div>

          {/* Navigation Links */}
          <nav className="workspace-nav-list" aria-label="Sidebar links">
            {items.map((item) =>
              item.notification ? (
                <NotificationNavItem onNavigate={close} key={item.label} />
              ) : (
                <WorkspaceLink item={item} onNavigate={close} key={`${item.label}-${item.to}`} />
              )
            )}
          </nav>

          {/* Sidebar Footer with Logout */}
          <div className="workspace-sidebar-footer">
            <button
              className="workspace-link workspace-logout"
              type="button"
              onClick={() => {
                close();
                logout();
              }}
            >
              <span className="workspace-link-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </span>
              <span className="workspace-link-text">Logout</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="workspace-main">{children}</main>
      </div>
    </div>
  );
}
