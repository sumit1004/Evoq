import { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate, Navigate } from 'react-router-dom';
import { fetchPublicPlayerProfile } from '../../services/playerProfileApi.js';
import { openDirectConversation } from '../../services/directMessageApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { normalizeApiError } from '../../services/apiClient.js';

export function PublicPlayerProfilePage() {
  const { evoqId } = useParams();
  const navigate = useNavigate();
  const { identity } = useAuth();

  if (evoqId === 'profile') {
    return <Navigate to="/player/profile" replace />;
  }

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [messaging, setMessaging] = useState(false);

  const load = useCallback(async () => {
    if (!evoqId || evoqId === 'profile') return;
    try {
      setLoading(true);
      setError('');
      const cleanedId = decodeURIComponent(evoqId).trim().replace(/\s+/g, '-');
      const data = await fetchPublicPlayerProfile(cleanedId);
      setProfile(data);
    } catch (err) {
      const norm = normalizeApiError(err);
      setError(norm.message);
    } finally {
      setLoading(false);
    }
  }, [evoqId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCopyId = () => {
    if (profile?.identity?.uniquePlayerId) {
      navigator.clipboard.writeText(profile.identity.uniquePlayerId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleMessagePlayer = async () => {
    if (!identity) {
      navigate(`/login?redirect=/player/${evoqId}`);
      return;
    }

    if (!profile?.identity?.userId) return;

    try {
      setMessaging(true);
      const result = await openDirectConversation({ recipientUserId: profile.identity.userId });
      navigate(`/player/messages/${result.conversation.id}`);
    } catch (err) {
      const norm = normalizeApiError(err);
      alert(norm.message || 'Unable to open conversation');
    } finally {
      setMessaging(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-hub-page" style={{ padding: '2rem 1rem' }}>
        <div className="dashboard-skeleton skeleton-wide" style={{ height: '140px' }} />
        <div className="dashboard-skeleton skeleton-wide" style={{ height: '320px' }} />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="profile-hub-page" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
        <div className="dashboard-error" style={{ maxWidth: '500px', margin: '0 auto 1.5rem' }}>
          <span>{error || 'Player profile not found or is set to private.'}</span>
        </div>
        <Link to="/player/search" className="button primary-button" style={{ display: 'inline-flex' }}>
          ← Search Other Players
        </Link>
      </div>
    );
  }

  const { identity: playerIdentity, primaryGame, gameProfiles, currentTeam, tournamentHistory, performance, achievements } = profile;
  const isOwnProfile = identity && Number(identity.id) === Number(playerIdentity?.userId);

  return (
    <div className="profile-hub-page" style={{ padding: '2rem 1rem' }}>
      {/* Top Header Card */}
      <section className="profile-banner-card">
        <div className="profile-banner-accent" />
        <div className="profile-header-main">
          <div className="profile-identity-group">
            <div className="profile-avatar-wrapper">
              {playerIdentity?.avatarUrl ? (
                <img src={playerIdentity.avatarUrl} alt={playerIdentity.name} className="profile-avatar-img" />
              ) : (
                playerIdentity?.name?.slice(0, 1).toUpperCase() || 'P'
              )}
            </div>

            <div className="profile-identity-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1>{playerIdentity?.name}</h1>
                <span className="badge-tag exp" style={{ fontSize: '0.72rem' }}>Verified Player</span>
              </div>

              <div className="profile-evoq-id-badge">
                <span>{playerIdentity?.uniquePlayerId}</span>
                <button
                  type="button"
                  className="copy-id-btn"
                  onClick={handleCopyId}
                  title="Copy EVOQ ID"
                >
                  {copiedId ? '[Copied]' : '[Copy]'}
                </button>
              </div>

              <div className="profile-meta-tags">
                {primaryGame && (
                  <>
                    <span className="badge-tag game">{primaryGame.gameName}</span>
                    <span className="badge-tag role">{primaryGame.primaryRole}</span>
                    <span className="badge-tag exp">{primaryGame.experience?.text || 'Competitor'}</span>
                  </>
                )}
                {currentTeam && <span className="badge-tag team">Team: {currentTeam.name}</span>}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {!isOwnProfile && (
              <button
                className="button primary-button"
                type="button"
                onClick={handleMessagePlayer}
                disabled={messaging}
                style={{ minHeight: '34px', fontSize: '0.85rem' }}
              >
                {messaging ? 'Opening Chat...' : 'Message'}
              </button>
            )}
            <Link to="/player/search" className="button secondary-button" style={{ minHeight: '34px', fontSize: '0.85rem' }}>
              ← Search Players
            </Link>
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <div className="profile-grid-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Performance Overview (if public) */}
          {performance && (
            <div className="profile-panel-card">
              <div className="profile-panel-head">
                <h2>Verified Performance Snapshot</h2>
                <span className="badge-tag exp">Official EVOQ Stats</span>
              </div>

              <div className="profile-summary-grid">
                <div className="stat-tile verified">
                  <span>Official Tourneys</span>
                  <strong>{performance?.official?.tournamentsPlayed || 0}</strong>
                  <small>Verified</small>
                </div>
                <div className="stat-tile verified">
                  <span>Tourney Wins</span>
                  <strong>{performance?.official?.wins || 0}</strong>
                  <small>1st Place</small>
                </div>
                <div className="stat-tile verified">
                  <span>Top 3 Finishes</span>
                  <strong>{performance?.official?.top3Finishes || 0}</strong>
                  <small>Podiums</small>
                </div>
                <div className="stat-tile verified">
                  <span>Official Matches</span>
                  <strong>{performance?.official?.matchesPlayed || 0}</strong>
                  <small>{performance?.official?.avgKills || 0} avg kills</small>
                </div>
                {performance.practice && (
                  <div className="stat-tile">
                    <span>Practice Matches</span>
                    <strong>{performance.practice.matchesPlayed || 0}</strong>
                    <small>{performance.practice.avgDamage || 0} avg dmg</small>
                  </div>
                )}
              </div>

              {/* Rating if available */}
              {performance.rating?.score != null && (
                <div className="rating-card" style={{ marginTop: '0.5rem', padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: '#8b949e', textTransform: 'uppercase', fontWeight: 700 }}>
                        EVOQ Performance Rating
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#f39c12' }}>
                          {performance.rating.score}
                        </span>
                        <span className="rating-tier-badge">{performance.rating.tier}</span>
                      </div>
                    </div>
                    <small style={{ color: '#8b949e', maxWidth: '280px', textAlign: 'right' }}>
                      {performance.rating.formulaExplanation}
                    </small>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Game Profiles */}
          <div className="profile-panel-card">
            <div className="profile-panel-head">
              <h2>Registered Esports Titles ({gameProfiles?.length || 0})</h2>
            </div>
            {(!gameProfiles || gameProfiles.length === 0) ? (
              <p style={{ color: '#8b949e', margin: 0 }}>No public game profiles.</p>
            ) : (
              <div className="game-profiles-grid">
                {gameProfiles.map((g, idx) => (
                  <div key={idx} className={`game-profile-card ${g.isPrimary ? 'primary' : ''}`}>
                    <div className="game-profile-top">
                      <h4>{g.gameName}</h4>
                      {g.isPrimary && <span className="badge-tag game" style={{ fontSize: '0.7rem' }}>Primary</span>}
                    </div>
                    <div className="game-details-list">
                      <div className="game-details-row">
                        <span>IGN</span>
                        <strong>{g.inGameName}</strong>
                      </div>
                      {g.gameUid && (
                        <div className="game-details-row">
                          <span>Game UID</span>
                          <strong>{g.gameUid}</strong>
                        </div>
                      )}
                      <div className="game-details-row">
                        <span>Primary Role</span>
                        <strong>{g.primaryRole}</strong>
                      </div>
                      {g.secondaryRole && (
                        <div className="game-details-row">
                          <span>Secondary Role</span>
                          <strong>{g.secondaryRole}</strong>
                        </div>
                      )}
                      <div className="game-details-row">
                        <span>Experience</span>
                        <strong>{g.experience?.text || 'Active'}</strong>
                      </div>
                      {g.currentRank && (
                        <div className="game-details-row">
                          <span>Current Rank</span>
                          <strong>{g.currentRank}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tournament History (if public) */}
          {tournamentHistory && tournamentHistory.length > 0 && (
            <div className="profile-panel-card">
              <div className="profile-panel-head">
                <h2>Official Tournament History ({tournamentHistory.length})</h2>
                <span className="badge-tag exp">EVOQ Verified</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="session-matches-table">
                  <thead>
                    <tr>
                      <th>Tournament</th>
                      <th>Game</th>
                      <th>Team</th>
                      <th>Placement</th>
                      <th>Matches</th>
                      <th>Kills</th>
                      <th>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tournamentHistory.map((t, idx) => (
                      <tr key={idx}>
                        <td><strong>{t.tournamentName}</strong></td>
                        <td><span className="badge-tag game" style={{ fontSize: '0.72rem' }}>{t.game}</span></td>
                        <td>{t.teamName}</td>
                        <td>
                          {t.finalRank != null ? (
                            <strong style={{ color: t.finalRank === 1 ? '#f39c12' : t.finalRank <= 3 ? '#2ecc71' : '#f6f8fb' }}>
                              #{t.finalRank}
                            </strong>
                          ) : '-'}
                        </td>
                        <td>{t.matchesPlayed}</td>
                        <td><strong>{t.totalKills}</strong></td>
                        <td>{t.totalPoints}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Achievements (if public) */}
          {achievements && achievements.length > 0 && (
            <div className="profile-panel-card">
              <div className="profile-panel-head">
                <h2>Achievements ({achievements.length})</h2>
              </div>
              <div className="achievements-grid">
                {achievements.map((ach) => (
                  <div key={ach.id} className="achievement-card unlocked">
                    <span className="badge-tag exp" style={{ width: 'fit-content', fontSize: '0.7rem' }}>
                      {ach.category} · {ach.verified ? 'Verified' : 'Milestone'}
                    </span>
                    <strong className="achievement-title">{ach.title}</strong>
                    <p className="achievement-desc">{ach.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: About & Bio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="profile-panel-card">
            <div className="profile-panel-head">
              <h2>Player Resume</h2>
            </div>
            <p style={{ color: '#c9d1d9', fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>
              {identity?.bio || 'No public bio provided.'}
            </p>

            <div style={{ borderTop: '1px solid rgba(240,246,252,0.06)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b949e' }}>
                <span>Location</span>
                <strong style={{ color: '#f6f8fb' }}>
                  {[identity?.city, identity?.country].filter(Boolean).join(', ') || 'Global'}
                </strong>
              </div>
              {currentTeam && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b949e' }}>
                  <span>Current Team</span>
                  <strong style={{ color: '#9b59b6' }}>{currentTeam.name}</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b949e' }}>
                <span>Member Since</span>
                <strong style={{ color: '#f6f8fb' }}>
                  {identity?.memberSince ? new Date(identity.memberSince).toLocaleDateString() : 'Active'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
