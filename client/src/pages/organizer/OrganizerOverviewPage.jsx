import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchOrganizerDashboard } from '../../services/organizerApi.js';
import { useSocket } from '../../context/SocketContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

function Skeleton({ wide = false }) { return <div className={wide ? 'dashboard-skeleton skeleton-wide' : 'dashboard-skeleton'} aria-hidden="true"><span /><span /><span /></div>; }
function ErrorState({ message, retry }) { return <div className="dashboard-error" role="alert"><span>{message}</span><button className="text-button" type="button" onClick={retry}>Retry</button></div>; }
function Status({ value }) { return <span className={`dashboard-status status-${String(value || '').toLowerCase()}`}>{String(value || 'UNKNOWN').replaceAll('_', ' ')}</span>; }

export function OrganizerOverviewPage() {
  const { identity } = useAuth();
  const { on } = useSocket();
  const [dashboard, setDashboard] = useState(null);
  const [state, setState] = useState({ loading: true, error: '' });

  const load = useCallback(async () => {
    setState({ loading: true, error: '' });
    try {
      const data = await fetchOrganizerDashboard();
      setDashboard(data);
      setState({ loading: false, error: '' });
    } catch (error) {
      setState({ loading: false, error: error.message || 'Unable to load dashboard.' });
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const refresh = () => load();
    const removeNotification = on('notification', refresh);
    const removeAnnouncement = on('announcement', refresh);
    return () => { removeNotification(); removeAnnouncement(); };
  }, [load, on]);

  if (state.loading) return <section className="dashboard-page organizer-dashboard"><Skeleton wide /><Skeleton /><Skeleton wide /></section>;
  if (!dashboard) return <section className="dashboard-page organizer-dashboard"><ErrorState message={state.error} retry={load} /></section>;

  const { metrics, actionRequired, tournaments, upcomingDeadlines, liveOperations, recentActivity, unreadNotifications } = dashboard;
  const hasTournaments = tournaments.length > 0;

  if (!hasTournaments) {
    return (
      <section className="dashboard-page organizer-dashboard dashboard-empty-state">
        <div className="dashboard-welcome empty-welcome">
          <div>
            <h1>Welcome to EVOQ, {identity?.name}</h1>
            <p>You don't have any tournaments yet.</p>
            <p className="empty-subtext">Create your first tournament to start managing registrations, groups and matches.</p>
          </div>
          <Link className="button primary-button" to="/organizer/tournaments">+ Create Tournament</Link>
        </div>
      </section>
    );
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <section className="dashboard-page organizer-dashboard">
      <header className="dashboard-welcome">
        <div>
          <h1>{getGreeting()}, {identity?.name}</h1>
          <p>Your tournament operations at a glance.</p>
        </div>
        <Link className="button primary-button" to="/organizer/tournaments">+ Create Tournament</Link>
      </header>

      <div className="dashboard-summary">
        <div className="summary-tile"><span>Active</span><strong>{metrics.active}</strong></div>
        <div className="summary-tile"><span>Pending Reviews</span><strong>{metrics.pendingReviews}</strong></div>
        <div className="summary-tile"><span>Live Tournaments</span><strong>{metrics.live}</strong></div>
        <div className="summary-tile"><span>Upcoming</span><strong>{metrics.upcoming}</strong></div>
        <div className="summary-tile"><span>Completed</span><strong>{metrics.completed}</strong></div>
        <div className="summary-tile"><span>Total Teams</span><strong>{metrics.totalTeams}</strong></div>
      </div>

      {(actionRequired.pendingRegistrations.length > 0 || actionRequired.pendingGroups.length > 0) && (
        <section className="dashboard-section action-required">
          <div className="dashboard-section-head">
            <div>
              <span className="section-label critical">Action Required</span>
              <h2>Needs your attention</h2>
            </div>
          </div>
          <div className="action-list">
            {actionRequired.pendingRegistrations.map((item) => (
              <div className="action-card" key={`reg-${item.tournamentId}`}>
                <div>
                  <strong>{item.count} registrations waiting for verification</strong>
                  <span>{item.tournamentName}</span>
                </div>
                <Link className="button secondary-button" to={`/organizer/tournaments/${item.tournamentId}/registrations`}>Review Registrations</Link>
              </div>
            ))}
            {actionRequired.pendingGroups.map((item) => (
              <div className="action-card" key={`grp-${item.groupId}`}>
                <div>
                  <strong>Group matches completed but leaderboard needs review</strong>
                  <span>{item.tournamentName} · {item.roundName} · {item.groupName}</span>
                </div>
                <Link className="button secondary-button" to={`/organizer/tournaments/${item.tournamentId}/groups/${item.groupId}`}>Manage Group</Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="dashboard-columns">
        <div className="main-column">
          <section className="dashboard-section">
            <div className="dashboard-section-head">
              <div><span className="section-label">Operations</span><h2>My Tournaments</h2></div>
              <Link className="text-link" to="/organizer/tournaments">View all</Link>
            </div>
            <div className="dashboard-tournament-list">
              {tournaments.slice(0, 5).map((t) => (
                <div className="dashboard-tournament compact" key={t.id}>
                  <div className="tournament-accent" />
                  <div className="compact-info">
                    <div className="row-header">
                      <h3>{t.name}</h3>
                      <Status value={t.status} />
                    </div>
                    <p className="row-meta">
                      {t.totalRegistrations} teams
                      {t.currentRound ? ` · ${t.currentRound}` : ''}
                      {t.currentGroups ? ` · ${t.currentGroups} groups` : ''}
                    </p>
                  </div>
                  <Link className="button secondary-button" to={`/organizer/tournaments/${t.id}`}>Manage</Link>
                </div>
              ))}
            </div>
          </section>

          {liveOperations.length > 0 && (
            <section className="dashboard-section live-ops">
              <div className="dashboard-section-head">
                <div><span className="section-label live-indicator">Live Now</span><h2>Live Operations</h2></div>
              </div>
              <div className="live-ops-list">
                {liveOperations.map(l => (
                  <div className="live-op-card" key={l.tournamentId}>
                    <div className="live-op-header">
                      <h3>{l.tournamentName}</h3>
                      <Link className="button primary-button" to={`/organizer/tournaments/${l.tournamentId}`}>Open Live Operations</Link>
                    </div>
                    <div className="live-op-stats">
                      <div><span>Round</span><strong>{l.roundName || 'N/A'}</strong></div>
                      <div><span>Groups</span><strong>{l.activeGroups}</strong></div>
                      <div><span>Teams</span><strong>{l.verifiedPlayers}</strong></div>
                    </div>
                    <div className="live-op-matches">
                      <span>Matches:</span>
                      <span className="match-stat success">{l.completedMatches} completed</span>
                      <span className="match-stat warning">{l.liveMatches} in progress</span>
                      <span className="match-stat neutral">{l.pendingMatches} pending</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="side-column">
          {upcomingDeadlines.length > 0 && (
            <section className="dashboard-section">
              <div className="dashboard-section-head">
                <div><span className="section-label">Schedule</span><h2>Upcoming Deadlines</h2></div>
              </div>
              <div className="deadline-list">
                {upcomingDeadlines.map((d, i) => (
                  <div className="deadline-item" key={i}>
                    <strong>{d.type === 'REGISTRATION_CLOSE' ? 'Registration closes' : 'Round begins'}</strong>
                    <span>{d.tournamentName}</span>
                    <time>{new Date(d.date).toLocaleString()}</time>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="dashboard-section">
            <div className="dashboard-section-head">
              <div><span className="section-label">Updates</span><h2>Recent Activity</h2></div>
              <Link className="text-link" to="/notifications">View all {unreadNotifications > 0 ? `(${unreadNotifications})` : ''}</Link>
            </div>
            {!recentActivity.length ? (
               <div className="dashboard-empty"><p>No recent activity.</p></div>
            ) : (
              <div className="activity-list">
                {recentActivity.map(a => (
                  <div className="activity-item compact-activity" key={a.id}>
                    <span className="activity-dot" />
                    <div>
                      <strong>{a.type.replaceAll('_', ' ')}</strong>
                      <p>{a.content}</p>
                    </div>
                    <time>{new Date(a.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</time>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
