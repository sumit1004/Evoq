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
  return <Link className="workspace-link notification-nav-link" to="/notifications" onClick={onNavigate}><span>Notifications</span>{unread > 0 && <span className="sidebar-notification-count" aria-label={`${unread} unread notifications`}>{unread}</span>}</Link>;
}
