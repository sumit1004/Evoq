import { useEffect, useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import * as staffApi from '../../services/staffApi.js';
import { WorkspaceShell } from '../../components/WorkspaceShell.jsx';
import { getScoutNavigation } from '../../config/workspaceNavigation.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { hasActiveScoutRole } from '../../utils/workspaceRouting.js';

export function ScoutWorkspacePage() {
  const { identity, loading: authLoading } = useAuth();
  const { on } = useSocket();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);

  const loadScoutTournaments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await staffApi.fetchScoutAssignedTournaments();
      setTournaments(res.tournaments || res || []);
    } catch (err) {
      setError(err.message || 'Failed to load assigned tournaments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (identity) {
      loadScoutTournaments();
    }
  }, [identity]);

  // Listen for realtime revocation/permission update events
  useEffect(() => {
    const handleUpdate = () => {
      loadScoutTournaments();
    };
    const offUpdated = on?.('staff_access_updated', handleUpdate);
    const offRevoked = on?.('staff_access_revoked', handleUpdate);
    return () => {
      offUpdated?.();
      offRevoked?.();
    };
  }, [on]);

  if (authLoading) {
    return <div className="route-loading" role="status">Restoring your EVOQ session...</div>;
  }

  if (!identity) {
    return <Navigate to="/login" replace />;
  }

  if (identity.role !== 'ORGANIZER' && !hasActiveScoutRole(identity) && tournaments.length === 0 && !loading) {
    return <Navigate to="/player/dashboard" replace />;
  }

  const filteredTournaments = tournaments.filter((t) => {
    if (!t) return false;
    const q = (search || '').trim().toLowerCase();
    if (!q) return true;
    const name = String(t.tournamentName || t.name || '');
    const game = String(t.game || '');
    const orgName = String(t.organizationName || t.organizerName || '');
    return (
      name.toLowerCase().includes(q) ||
      game.toLowerCase().includes(q) ||
      orgName.toLowerCase().includes(q)
    );
  });

  const navItems = getScoutNavigation();

  return (
    <WorkspaceShell label="Scout Console" items={navItems}>
      <div className="scouts-container">
        {/* Header Bar */}
        <header className="scouts-header">
          <div className="scouts-header-content">
            <div className="scouts-badge-wrapper">
              <span className="scouts-badge">
                <span className="badge-pulse-dot" />
                SCOUT WORKSPACE
              </span>
            </div>
            <h1 className="scouts-title">Assigned Tournaments</h1>
            <p className="scouts-subtitle">
              Manage live scoring, group operations, team verification, and match coordination for your assigned tournaments.
            </p>
          </div>
        </header>

        {error && (
          <div className="scouts-alert alert-error" role="alert">
            <span>{error}</span>
            <button type="button" className="alert-close" onClick={() => setError(null)}>×</button>
          </div>
        )}

        {/* Search Bar */}
        <div className="scout-search-bar">
          <input
            type="text"
            className="scout-search-input"
            placeholder="Search your assigned tournaments by name, game, or organization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Tournament Cards Grid */}
        {loading ? (
          <div className="scouts-loading-state">
            <div className="spinner"></div>
            <p>Loading your assigned tournaments...</p>
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div className="scouts-empty-state">
            <div className="empty-icon-shield">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polygon points="12 8 8 12 12 16 16 12 12 8"></polygon>
              </svg>
            </div>
            <h3>No assigned tournaments found</h3>
            <p>
              {search
                ? 'No tournament matches your search query.'
                : "You have not been assigned as a Scout to any tournaments yet. When an Organizer assigns you, your assigned duties will appear here."}
            </p>
          </div>
        ) : (
          <div className="scout-tournaments-grid">
            {filteredTournaments.map((t) => {
              const perms = t.permissions || [];
              const isAll = Boolean(t.allGroups ?? t.all_groups);
              const groupIds = t.assignedGroupIds || (t.assignedGroups ? t.assignedGroups.map(g => g.groupId) : []);
              const tourneyId = t.tournamentId || t.id;
              const tourneyName = t.tournamentName || t.name || 'Tournament';
              const tourneyStatus = (t.tournamentStatus || t.status || 'ACTIVE').toLowerCase();

              return (
                <div key={t.staffId || tourneyId} className="scout-tournament-card">
                  <div className="card-header">
                    <span className="card-game-badge">{t.game || 'Free Fire'}</span>
                    <span className={`card-status-badge status-${tourneyStatus}`}>
                      {t.tournamentStatus || t.status || 'ACTIVE'}
                    </span>
                  </div>

                  <h3 className="card-tournament-name">{tourneyName}</h3>
                  <div className="card-org-name">
                    Organizer: <strong>{t.organizationName || t.organizerName || 'Tournament Organizer'}</strong>
                  </div>

                  <div className="card-scope-badge">
                    <span className="scope-icon">📍</span>
                    {isAll ? (
                      <strong>All Groups Access</strong>
                    ) : (
                      <strong>{groupIds.length} Assigned Group{groupIds.length === 1 ? '' : 's'}</strong>
                    )}
                  </div>

                  <div className="card-permissions-box">
                    <span className="box-title">Granted Capabilities ({perms.length}):</span>
                    <div className="card-perms-list">
                      {perms.slice(0, 4).map((p) => (
                        <span key={p} className="perm-chip">
                          {p.replaceAll('_', ' ')}
                        </span>
                      ))}
                      {perms.length > 4 && (
                        <span className="perm-more-chip">+{perms.length - 4} more</span>
                      )}
                    </div>
                  </div>

                  <div className="card-footer">
                    <button
                      type="button"
                      className="launch-console-btn"
                      onClick={() => navigate(`/scout/tournaments/${tourneyId}`)}
                    >
                      Launch Scout Console →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
