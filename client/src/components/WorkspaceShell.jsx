import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { NotificationNavItem } from './NotificationNavItem.jsx';

function WorkspaceLink({ item, onNavigate }) {
  const location = useLocation();
  const active = item.active ? item.active(location.pathname) : location.pathname === item.to;
  return <Link className={`workspace-link${active ? ' active' : ''}`} to={item.to} onClick={onNavigate}>{item.label}</Link>;
}

export function WorkspaceShell({ label, items, children }) {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const { identity, logout } = useAuth();
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (event.key === 'Escape') { setOpen(false); menuButtonRef.current?.focus(); } };
    document.addEventListener('keydown', close);
    document.body.classList.add('drawer-open');
    return () => { document.removeEventListener('keydown', close); document.body.classList.remove('drawer-open'); };
  }, [open]);
  const close = () => setOpen(false);
  const toggle = () => setOpen((value) => !value);
  return <div className="workspace-shell">
    <div className="workspace-mobile-bar">
      <button ref={menuButtonRef} className="menu-button" type="button" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="workspace-sidebar" onClick={toggle}><span className={open ? 'menu-bars is-open' : 'menu-bars'} aria-hidden="true"><i /><i /><i /></span></button>
      <Link className="brand" to={identity?.role === 'ORGANIZER' ? '/organizer' : '/player/dashboard'}>EVOQ</Link>
    </div>
    <div className="workspace-layout">
      {open && <button className="drawer-backdrop" aria-label="Close navigation" type="button" onClick={close} />}
      <aside id="workspace-sidebar" className={`workspace-sidebar${open ? ' is-open' : ''}`} aria-label={`${label} navigation`}>
        <div className="workspace-sidebar-brand"><Link className="brand" to={identity?.role === 'ORGANIZER' ? '/organizer' : '/player/dashboard'} onClick={close}>EVOQ</Link><button className="drawer-close" aria-label="Close navigation" type="button" onClick={close}>×</button></div>
        <div className="workspace-identity"><strong>{identity?.name}</strong><span>{label}</span></div>
        <div className="workspace-sidebar-head"><div className="workspace-label">Workspace</div></div>
        {items.map((item) => item.notification ? <NotificationNavItem onNavigate={close} key={item.label} /> : <WorkspaceLink item={item} onNavigate={close} key={`${item.label}-${item.to}`} />)}
        <div className="workspace-sidebar-footer"><button className="workspace-link workspace-logout" type="button" onClick={() => { close(); logout(); }}>Logout</button></div>
      </aside>
      <main className="workspace-main">{children}</main>
    </div>
  </div>;
}
