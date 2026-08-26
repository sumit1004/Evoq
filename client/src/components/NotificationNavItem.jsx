import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchNotifications } from '../services/communicationApi.js';
import { useSocket } from '../context/SocketContext.jsx';

export function NotificationNavItem({ onNavigate }) {
  const { on } = useSocket();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!window.localStorage.getItem('evoq.accessToken')) return undefined;
    let active = true;
    fetchNotifications().then(({ notifications }) => { if (active) setUnread(notifications.filter((item) => !item.readAt).length); }).catch(() => {});
    const remove = on('notification', (item) => { if (!item.readAt) setUnread((count) => count + 1); });
    return () => { active = false; remove?.(); };
  }, [on]);
  return (
    <Link className="workspace-link notification-nav-link" to="/notifications" onClick={onNavigate} title="Notifications">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className="workspace-link-icon">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </span>
        <span className="workspace-link-text">Notifications</span>
      </div>
      {unread > 0 && <span className="sidebar-notification-count" aria-label={`${unread} unread notifications`}>{unread}</span>}
    </Link>
  );
}
