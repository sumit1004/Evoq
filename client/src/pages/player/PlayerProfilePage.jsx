import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  fetchMyEsportsProfile,
  updateMyEsportsProfile,
  createGameProfile,
  updateGameProfile,
  deleteGameProfile,
  fetchPracticeSessions,
  createPracticeSession,
  deletePracticeSession,
  createPracticeMatch,
  updatePracticeMatch,
  deletePracticeMatch,
  fetchPlayerTournamentHistory,
  fetchPlayerMatchHistory,
} from '../../services/playerProfileApi.js';
import { SUPPORTED_GAMES, getRolesForGame, getRanksForGame } from '../../utils/gameConfig.js';
import { normalizeApiError } from '../../services/apiClient.js';

function EmptyState({ title, description, actionText, onAction }) {
  return (
    <div className="dashboard-empty" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
      <strong style={{ display: 'block', fontSize: '1.1rem', color: '#f6f8fb', marginBottom: '0.5rem' }}>
        {title}
      </strong>
      <p style={{ color: '#8b949e', maxWidth: '420px', margin: '0 auto 1rem' }}>{description}</p>
      {actionText && onAction && (
        <button className="button primary-button" type="button" onClick={onAction}>
          {actionText}
        </button>
      )}
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div className="dashboard-error" role="alert" style={{ marginBottom: '1rem' }}>
      <span>{message}</span>
      {onRetry && (
        <button className="text-button" type="button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function PlayerProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(false);

  // Modals & Wizard state
  const [showWizard, setShowWizard] = useState(false);
  const [showGameModal, setShowGameModal] = useState(false);
  const [editingGame, setEditingGame] = useState(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [editingMatch, setEditingMatch] = useState(null);

  // Tab specific data states
  const [tournaments, setTournaments] = useState([]);
  const [matchesData, setMatchesData] = useState({ matches: [], total: 0 });
  const [matchFilters, setMatchFilters] = useState({ type: 'ALL', game: '', page: 1 });
  const [sessionsData, setSessionsData] = useState({ sessions: [], total: 0 });

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchMyEsportsProfile();
      setProfile(data);
    } catch (err) {
      const norm = normalizeApiError(err);
      setError(norm.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const loadTabContent = useCallback(async () => {
    if (activeTab === 'tournaments') {
      try {
        const data = await fetchPlayerTournamentHistory();
        setTournaments(data);
      } catch (err) {
        console.error(err);
      }
    } else if (activeTab === 'matches') {
      try {
        const data = await fetchPlayerMatchHistory({
          type: matchFilters.type,
          game: matchFilters.game || undefined,
          limit: 20,
          offset: (matchFilters.page - 1) * 20,
        });
        setMatchesData(data);
      } catch (err) {
        console.error(err);
      }
    } else if (activeTab === 'practice') {
      try {
        const data = await fetchPracticeSessions();
        setSessionsData(data);
      } catch (err) {
        console.error(err);
      }
    }
  }, [activeTab, matchFilters]);

  useEffect(() => {
    loadTabContent();
  }, [loadTabContent]);

  const setTab = (tabName) => {
    setSearchParams({ tab: tabName });
  };

  const handleCopyEvoqId = () => {
    if (profile?.identity?.uniquePlayerId) {
      navigator.clipboard.writeText(profile.identity.uniquePlayerId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  if (loading && !profile) {
    return (
      <div className="profile-hub-page">
        <div className="dashboard-skeleton skeleton-wide" style={{ height: '140px' }} />
        <div className="dashboard-skeleton skeleton-wide" style={{ height: '300px' }} />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="profile-hub-page">
        <ErrorBanner message={error} onRetry={loadProfile} />
      </div>
    );
  }

  const { identity, primaryGame, completion, performance, achievements, currentTeam } = profile || {};

  return (
    <div className="profile-hub-page">
      {/* --- Esports Identity Header --- */}
      <section className="profile-banner-card">
        <div className="profile-banner-accent" />
        <div className="profile-header-main">
          <div className="profile-identity-group">
            <div className="profile-avatar-wrapper">
              {identity?.avatarUrl ? (
                <img src={identity.avatarUrl} alt={identity.name} className="profile-avatar-img" />
              ) : (
                identity?.name?.slice(0, 1).toUpperCase() || 'P'
              )}
            </div>

            <div className="profile-identity-info">
              <h1>{identity?.name}</h1>
              <div className="profile-evoq-id-badge">
                <span>{identity?.uniquePlayerId}</span>
                <button
                  type="button"
                  className="copy-id-btn"
                  onClick={handleCopyEvoqId}
                  title="Copy permanent EVOQ ID"
                >
                  {copiedId ? '[Copied]' : '[Copy]'}
                </button>
              </div>

              <div className="profile-meta-tags">
                {primaryGame ? (
                  <>
                    <span className="badge-tag game">{primaryGame.gameName}</span>
                    <span className="badge-tag role">{primaryGame.primaryRole}</span>
                    <span className="badge-tag exp">{primaryGame.experience?.text || 'Rookie'}</span>
                  </>
                ) : (
                  <span className="badge-tag game">No Game Profile</span>
                )}
                {currentTeam && <span className="badge-tag team">Team: {currentTeam.name}</span>}
              </div>
            </div>
          </div>

          {/* Profile Completion Meter */}
          <div className="profile-completion-widget">
            <div className="completion-text">
              <span>Profile Completion</span>
              <strong>{completion?.percentage || 0}%</strong>
            </div>
            <div className="completion-progress-bar">
              <div
                className="completion-progress-fill"
                style={{ width: `${completion?.percentage || 0}%` }}
              />
            </div>
            {completion?.percentage < 100 && (
              <button
                type="button"
                className="button secondary-button"
                style={{ fontSize: '0.78rem', padding: '0 8px', minHeight: '30px' }}
                onClick={() => setShowWizard(true)}
              >
                Complete Setup
              </button>
            )}
          </div>
        </div>
      </section>

      {/* --- Sub-Tabs Navigation --- */}
      <nav className="profile-tabs-nav" aria-label="Profile navigation">
        <button
          type="button"
          className={`profile-tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          className={`profile-tab-button ${activeTab === 'performance' ? 'active' : ''}`}
          onClick={() => setTab('performance')}
        >
          Performance Analytics
        </button>
        <button
          type="button"
          className={`profile-tab-button ${activeTab === 'matches' ? 'active' : ''}`}
          onClick={() => setTab('matches')}
        >
          Match History
        </button>
        <button
          type="button"
          className={`profile-tab-button ${activeTab === 'practice' ? 'active' : ''}`}
          onClick={() => setTab('practice')}
        >
          Practice / Scrims
        </button>
        <button
          type="button"
          className={`profile-tab-button ${activeTab === 'tournaments' ? 'active' : ''}`}
          onClick={() => setTab('tournaments')}
        >
          Official Tournaments
        </button>
        <button
          type="button"
          className={`profile-tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setTab('settings')}
        >
          Settings & Privacy
        </button>
      </nav>

      {/* --- TAB 1: OVERVIEW --- */}
      {activeTab === 'overview' && (
        <div className="profile-grid-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Career Summary Tiles */}
            <div className="profile-panel-card">
              <div className="profile-panel-head">
                <h2>Career Snapshot</h2>
                <span style={{ fontSize: '0.8rem', color: '#8b949e' }}>Verified & Scrim Data</span>
              </div>
              <div className="profile-summary-grid">
                <div className="stat-tile verified">
                  <span>Official Tourneys</span>
                  <strong>{performance?.official?.tournamentsPlayed || 0}</strong>
                  <small>EVOQ Verified</small>
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
                <div className="stat-tile">
                  <span>Practice Matches</span>
                  <strong>{performance?.practice?.matchesPlayed || 0}</strong>
                  <small>Player Reported</small>
                </div>
                <div className="stat-tile">
                  <span>Practice Damage</span>
                  <strong>{performance?.practice?.avgDamage || 0}</strong>
                  <small>Avg / match</small>
                </div>
              </div>
            </div>

            {/* Game Profiles */}
            <div className="profile-panel-card">
              <div className="profile-panel-head">
                <h2>Game Profiles ({profile?.gameProfiles?.length || 0})</h2>
                <button
                  type="button"
                  className="button secondary-button"
                  style={{ minHeight: '30px', fontSize: '0.8rem', padding: '0 10px' }}
                  onClick={() => {
                    setEditingGame(null);
                    setShowGameModal(true);
                  }}
                >
                  + Add Game
                </button>
              </div>

              {(!profile?.gameProfiles || profile.gameProfiles.length === 0) ? (
                <EmptyState
                  title="No game profiles registered"
                  description="Add your in-game name, UID, and role for games like Free Fire, BGMI, or Valorant."
                  actionText="Register Game Profile"
                  onAction={() => {
                    setEditingGame(null);
                    setShowGameModal(true);
                  }}
                />
              ) : (
                <div className="game-profiles-grid">
                  {profile.gameProfiles.map((g) => (
                    <div key={g.id} className={`game-profile-card ${g.isPrimary ? 'primary' : ''}`}>
                      <div className="game-profile-top">
                        <h4>{g.gameName}</h4>
                        {g.isPrimary && <span className="badge-tag game" style={{ fontSize: '0.7rem' }}>Primary</span>}
                      </div>
                      <div className="game-details-list">
                        <div className="game-details-row">
                          <span>IGN</span>
                          <strong>{g.inGameName}</strong>
                        </div>
                        <div className="game-details-row">
                          <span>Game UID</span>
                          <strong>{g.gameUid}</strong>
                        </div>
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
                          <strong>{g.experience?.text || 'Not specified'}</strong>
                        </div>
                        {g.currentRank && (
                          <div className="game-details-row">
                            <span>Rank</span>
                            <strong>{g.currentRank}</strong>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button
                          type="button"
                          className="button secondary-button"
                          style={{ minHeight: '26px', fontSize: '0.75rem', padding: '0 8px', flex: 1 }}
                          onClick={() => {
                            setEditingGame(g);
                            setShowGameModal(true);
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Achievements */}
            <div className="profile-panel-card">
              <div className="profile-panel-head">
                <h2>Verified Achievements ({achievements?.length || 0})</h2>
              </div>
              {(!achievements || achievements.length === 0) ? (
                <EmptyState
                  title="No achievements unlocked yet"
                  description="Compete in official tournaments and log practice matches to unlock verified milestones."
                />
              ) : (
                <div className="achievements-grid">
                  {achievements.map((ach) => (
                    <div key={ach.id} className="achievement-card unlocked">
                      <span className="badge-tag exp" style={{ width: 'fit-content', fontSize: '0.7rem' }}>
                        {ach.category} · {ach.verified ? 'Verified' : 'Player Milestone'}
                      </span>
                      <strong className="achievement-title">{ach.title}</strong>
                      <p className="achievement-desc">{ach.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Bio & Checklist */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="profile-panel-card">
              <div className="profile-panel-head">
                <h2>About Player</h2>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setTab('settings')}
                  style={{ fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Edit Bio
                </button>
              </div>
              <p style={{ color: '#c9d1d9', fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>
                {identity?.bio || 'No bio written yet. Introduce yourself to organizers and scouts.'}
              </p>
              <div style={{ borderTop: '1px solid rgba(240,246,252,0.06)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b949e' }}>
                  <span>Location</span>
                  <strong style={{ color: '#f6f8fb' }}>
                    {[identity?.city, identity?.country].filter(Boolean).join(', ') || 'Not specified'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b949e' }}>
                  <span>Member Since</span>
                  <strong style={{ color: '#f6f8fb' }}>
                    {identity?.accountCreatedAt ? new Date(identity.accountCreatedAt).toLocaleDateString() : 'Active'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Profile Checklist */}
            <div className="profile-panel-card">
              <div className="profile-panel-head">
                <h2>Completion Checklist</h2>
                <strong style={{ color: completion?.isComplete ? '#2ecc71' : '#f39c12', fontSize: '0.9rem' }}>
                  {completion?.percentage || 0}%
                </strong>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {completion?.checklist?.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.85rem',
                      padding: '0.35rem 0',
                      borderBottom: '1px solid rgba(240,246,252,0.04)',
                    }}
                  >
                    <span style={{ color: item.completed ? '#f6f8fb' : '#8b949e' }}>
                      {item.completed ? '[DONE]' : '[TODO]'} {item.label}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#8b949e' }}>{item.category}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: PERFORMANCE ANALYTICS --- */}
      {activeTab === 'performance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Rating Card */}
          <div className="rating-card">
            <div className="profile-panel-head">
              <h2>EVOQ Performance Rating</h2>
              <span style={{ fontSize: '0.8rem', color: '#8b949e' }}>Deterministic Esports Index</span>
            </div>
            {performance?.rating?.score != null ? (
              <>
                <div className="rating-score-display">
                  <span className="rating-big-number">{performance.rating.score}</span>
                  <div>
                    <span className="rating-tier-badge">{performance.rating.tier}</span>
                    <p style={{ color: '#8b949e', fontSize: '0.85rem', margin: '4px 0 0' }}>
                      Based on {performance.rating.sampleSize} verified official & practice matches.
                    </p>
                  </div>
                </div>

                <div className="rating-breakdown-bars">
                  <div className="rating-bar-group">
                    <div className="rating-bar-label">
                      <span>Combat Efficiency (40%)</span>
                      <strong>{performance.rating.breakdown.combat} / 40</strong>
                    </div>
                    <div className="rating-bar-track">
                      <div
                        className="rating-bar-progress"
                        style={{ width: `${(performance.rating.breakdown.combat / 40) * 100}%`, background: '#e74c3c' }}
                      />
                    </div>
                  </div>

                  <div className="rating-bar-group">
                    <div className="rating-bar-label">
                      <span>Placement Reliability (40%)</span>
                      <strong>{performance.rating.breakdown.placement} / 40</strong>
                    </div>
                    <div className="rating-bar-track">
                      <div
                        className="rating-bar-progress"
                        style={{ width: `${(performance.rating.breakdown.placement / 40) * 100}%`, background: '#f39c12' }}
                      />
                    </div>
                  </div>

                  <div className="rating-bar-group">
                    <div className="rating-bar-label">
                      <span>Activity Volume (20%)</span>
                      <strong>{performance.rating.breakdown.volume} / 20</strong>
                    </div>
                    <div className="rating-bar-track">
                      <div
                        className="rating-bar-progress"
                        style={{ width: `${(performance.rating.breakdown.volume / 20) * 100}%`, background: '#2ecc71' }}
                      />
                    </div>
                  </div>
                </div>
                <small style={{ color: '#8b949e', fontSize: '0.78rem' }}>
                  {performance.rating.formulaExplanation}
                </small>
              </>
            ) : (
              <div style={{ padding: '1rem 0' }}>
                <strong style={{ color: '#f39c12', display: 'block', marginBottom: '4px' }}>
                  {performance?.rating?.tier || 'Insufficient Data'}
                </strong>
                <p style={{ color: '#8b949e', fontSize: '0.88rem', margin: 0 }}>
                  {performance?.rating?.message || 'At least 3 matches required to calculate performance rating.'}
                </p>
              </div>
            )}
          </div>

          {/* Detailed Stats Comparison */}
          <div className="profile-grid-layout">
            {/* Official Performance */}
            <div className="profile-panel-card">
              <div className="profile-panel-head">
                <h2>Official Tournament Performance</h2>
                <span className="badge-tag exp">EVOQ Verified</span>
              </div>
              <div className="profile-summary-grid">
                <div className="stat-tile">
                  <span>Tournaments</span>
                  <strong>{performance?.official?.tournamentsPlayed || 0}</strong>
                </div>
                <div className="stat-tile">
                  <span>Official Matches</span>
                  <strong>{performance?.official?.matchesPlayed || 0}</strong>
                </div>
                <div className="stat-tile">
                  <span>Total Kills</span>
                  <strong>{performance?.official?.totalKills || 0}</strong>
                </div>
                <div className="stat-tile">
                  <span>Avg Kills / Match</span>
                  <strong>{performance?.official?.avgKills || 0}</strong>
                </div>
                <div className="stat-tile">
                  <span>Avg Placement</span>
                  <strong>{performance?.official?.avgPlacement ? `#${performance.official.avgPlacement}` : 'N/A'}</strong>
                </div>
                <div className="stat-tile">
                  <span>Total Points</span>
                  <strong>{performance?.official?.totalPoints || 0}</strong>
                </div>
              </div>
            </div>

            {/* Practice Performance */}
            <div className="profile-panel-card">
              <div className="profile-panel-head">
                <h2>Practice & Scrim Performance</h2>
                <span className="badge-tag role">Player Reported</span>
              </div>
              <div className="profile-summary-grid">
                <div className="stat-tile">
                  <span>Practice Matches</span>
                  <strong>{performance?.practice?.matchesPlayed || 0}</strong>
                </div>
                <div className="stat-tile">
                  <span>Avg Damage</span>
                  <strong>{performance?.practice?.avgDamage || 0}</strong>
                </div>
                <div className="stat-tile">
                  <span>Avg Kills</span>
                  <strong>{performance?.practice?.avgKills || 0}</strong>
                </div>
                <div className="stat-tile">
                  <span>Best Placement</span>
                  <strong>{performance?.practice?.bestPlacement ? `#${performance.practice.bestPlacement}` : 'N/A'}</strong>
                </div>
                <div className="stat-tile">
                  <span>Top 3 Finishes</span>
                  <strong>{performance?.practice?.top3Finishes || 0}</strong>
                </div>
                <div className="stat-tile">
                  <span>Top 10 Finishes</span>
                  <strong>{performance?.practice?.top10Finishes || 0}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 3: MATCH HISTORY --- */}
      {activeTab === 'matches' && (
        <div className="profile-panel-card">
          <div className="profile-panel-head" style={{ flexWrap: 'wrap' }}>
            <h2>Match History ({matchesData.total || 0})</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                className="button secondary-button"
                style={{ minHeight: '32px', fontSize: '0.85rem' }}
                value={matchFilters.type}
                onChange={(e) => setMatchFilters({ ...matchFilters, type: e.target.value, page: 1 })}
              >
                <option value="ALL">All Matches</option>
                <option value="OFFICIAL">Official Verified</option>
                <option value="PRACTICE">Practice Reported</option>
              </select>
            </div>
          </div>

          {(!matchesData.matches || matchesData.matches.length === 0) ? (
            <EmptyState
              title="No match records found"
              description="Your official tournament matches and practice scrim matches will be displayed here."
              actionText="Log a Practice Match"
              onAction={() => setTab('practice')}
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="session-matches-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type / Event</th>
                    <th>Game</th>
                    <th>Team</th>
                    <th>Placement</th>
                    <th>Kills</th>
                    <th>Damage / Pts</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {matchesData.matches.map((m, idx) => (
                    <tr key={m.id || idx}>
                      <td>{new Date(m.playedAt).toLocaleDateString()}</td>
                      <td>
                        <strong>{m.tournamentName || m.sessionTitle || `Match ${m.matchNumber}`}</strong>
                        {m.roundName && <div style={{ fontSize: '0.75rem', color: '#8b949e' }}>{m.roundName} · {m.groupName}</div>}
                      </td>
                      <td>
                        <span className="badge-tag game" style={{ fontSize: '0.75rem' }}>{m.gameName}</span>
                      </td>
                      <td>{m.teamName || 'Solo / Team'}</td>
                      <td>
                        {m.placement != null ? (
                          <strong style={{ color: m.placement === 1 ? '#f39c12' : m.placement <= 3 ? '#2ecc71' : '#f6f8fb' }}>
                            #{m.placement}
                          </strong>
                        ) : '-'}
                      </td>
                      <td><strong>{m.kills}</strong></td>
                      <td>{m.damage ? `${m.damage} dmg` : m.points ? `${m.points} pts` : '-'}</td>
                      <td>
                        {m.source === 'OFFICIAL_VERIFIED' ? (
                          <span className="badge-tag exp" style={{ fontSize: '0.7rem' }}>EVOQ Verified</span>
                        ) : (
                          <span className="badge-tag role" style={{ fontSize: '0.7rem' }}>Player Reported</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 4: PRACTICE / SCRIMS --- */}
      {activeTab === 'practice' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="profile-panel-card">
            <div className="profile-panel-head">
              <div>
                <h2>Practice & Scrim Sessions ({sessionsData.total || 0})</h2>
                <p style={{ color: '#8b949e', fontSize: '0.85rem', margin: '4px 0 0' }}>
                  Track your custom lobby scrims, tournament warmups, and practice stats.
                </p>
              </div>
              <button
                type="button"
                className="button primary-button"
                onClick={() => setShowSessionModal(true)}
              >
                + New Practice Session
              </button>
            </div>

            {(!sessionsData.sessions || sessionsData.sessions.length === 0) ? (
              <EmptyState
                title="No practice sessions logged"
                description="Start recording your scrim lobbies to track kill and placement progress."
                actionText="Create First Session"
                onAction={() => setShowSessionModal(true)}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {sessionsData.sessions.map((sess) => (
                  <div key={sess.id} className="practice-session-item">
                    <div className="session-header">
                      <div className="session-title-group">
                        <span className="badge-tag game" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                          {sess.game_name}
                        </span>
                        <h4>{sess.title}</h4>
                        <div style={{ fontSize: '0.8rem', color: '#8b949e', marginTop: '2px' }}>
                          Date: {new Date(sess.session_date).toLocaleDateString()} {sess.team_name ? `· Team: ${sess.team_name}` : ''}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                          <div><strong>{sess.match_count}</strong> matches</div>
                          <div style={{ color: '#8b949e' }}>{sess.total_kills} kills · {sess.total_damage} dmg</div>
                        </div>
                        <button
                          type="button"
                          className="button secondary-button"
                          style={{ minHeight: '30px', fontSize: '0.8rem', padding: '0 8px' }}
                          onClick={() => {
                            setSelectedSessionId(sess.id);
                            setEditingMatch(null);
                            setShowMatchModal(true);
                          }}
                        >
                          + Add Match
                        </button>
                        <button
                          type="button"
                          className="text-button"
                          style={{ color: '#e74c3c', fontSize: '0.8rem' }}
                          onClick={async () => {
                            if (window.confirm('Delete this practice session and its matches?')) {
                              await deletePracticeSession(sess.id);
                              loadTabContent();
                              loadProfile();
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {sess.notes && (
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#8b949e', fontStyle: 'italic' }}>
                        Note: {sess.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 5: OFFICIAL TOURNAMENTS --- */}
      {activeTab === 'tournaments' && (
        <div className="profile-panel-card">
          <div className="profile-panel-head">
            <h2>Official EVOQ Tournament History ({tournaments?.length || 0})</h2>
            <span className="badge-tag exp">Source: EVOQ Platform</span>
          </div>

          {(!tournaments || tournaments.length === 0) ? (
            <EmptyState
              title="No official tournament participations yet"
              description="Register and compete in official EVOQ tournaments to automatically build your verified competition record."
              actionText="Browse Tournaments"
              onAction={() => window.location.assign('/tournaments')}
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="session-matches-table">
                <thead>
                  <tr>
                    <th>Tournament</th>
                    <th>Game</th>
                    <th>Registered Team</th>
                    <th>Status</th>
                    <th>Final Placement</th>
                    <th>Matches</th>
                    <th>Kills</th>
                    <th>Points</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tournaments.map((t) => (
                    <tr key={t.tournamentId}>
                      <td>
                        <strong>{t.tournamentName}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#8b949e' }}>
                          {t.tournamentDate ? new Date(t.tournamentDate).toLocaleDateString() : 'Date TBA'}
                        </div>
                      </td>
                      <td>
                        <span className="badge-tag game" style={{ fontSize: '0.75rem' }}>{t.game}</span>
                      </td>
                      <td>{t.teamName}</td>
                      <td>
                        <span className={`dashboard-status status-${t.status?.toLowerCase()}`}>
                          {t.status}
                        </span>
                      </td>
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
                      <td>
                        <Link
                          to={`/player/communications/${t.tournamentId}`}
                          className="button secondary-button"
                          style={{ minHeight: '28px', fontSize: '0.75rem', padding: '0 8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                        >
                          Hub →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 6: SETTINGS & PRIVACY --- */}
      {activeTab === 'settings' && (
        <div className="profile-grid-layout">
          {/* Basic Info Editor */}
          <div className="profile-panel-card">
            <div className="profile-panel-head">
              <h2>Basic Profile Information</h2>
            </div>
            <BasicInfoForm
              profile={profile}
              onSaved={() => {
                loadProfile();
                alert('Profile updated successfully.');
              }}
            />
          </div>

          {/* Privacy Controls */}
          <div className="profile-panel-card">
            <div className="profile-panel-head">
              <h2>Public Visibility Controls</h2>
            </div>
            <PrivacyControlsForm
              privacy={profile?.privacy}
              onSaved={() => {
                loadProfile();
                alert('Privacy settings saved.');
              }}
            />
          </div>
        </div>
      )}

      {/* --- MODAL: GAME PROFILE (ADD / EDIT) --- */}
      {showGameModal && (
        <GameProfileModal
          editingGame={editingGame}
          onClose={() => setShowGameModal(false)}
          onSuccess={() => {
            setShowGameModal(false);
            loadProfile();
          }}
        />
      )}

      {/* --- MODAL: PRACTICE SESSION --- */}
      {showSessionModal && (
        <PracticeSessionModal
          onClose={() => setShowSessionModal(false)}
          onSuccess={() => {
            setShowSessionModal(false);
            loadTabContent();
            loadProfile();
          }}
        />
      )}

      {/* --- MODAL: PRACTICE MATCH --- */}
      {showMatchModal && (
        <PracticeMatchModal
          sessionId={selectedSessionId}
          editingMatch={editingMatch}
          onClose={() => setShowMatchModal(false)}
          onSuccess={() => {
            setShowMatchModal(false);
            loadTabContent();
            loadProfile();
          }}
        />
      )}

      {/* --- MODAL: GUIDED PROFILE WIZARD --- */}
      {showWizard && (
        <GuidedSetupWizardModal
          profile={profile}
          onClose={() => setShowWizard(false)}
          onComplete={() => {
            setShowWizard(false);
            loadProfile();
          }}
        />
      )}
    </div>
  );
}

// ---------------- SUB-COMPONENTS & FORMS ---------------- //

function BasicInfoForm({ profile, onSaved }) {
  const [form, setForm] = useState({
    name: profile?.identity?.name || '',
    bio: profile?.identity?.bio || '',
    country: profile?.identity?.country || '',
    city: profile?.identity?.city || '',
    avatarUrl: profile?.identity?.avatarUrl || '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErr('');
      await updateMyEsportsProfile(form);
      onSaved();
    } catch (error) {
      const n = normalizeApiError(error);
      setErr(n.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {err && <div className="dashboard-error"><span>{err}</span></div>}
      <div className="form-field-group">
        <label>Display Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </div>

      <div className="form-row-2">
        <div className="form-field-group">
          <label>Country</label>
          <input
            type="text"
            value={form.country}
            placeholder="e.g. India"
            onChange={(e) => setForm({ ...form, country: e.target.value })}
          />
        </div>
        <div className="form-field-group">
          <label>City</label>
          <input
            type="text"
            value={form.city}
            placeholder="e.g. Mumbai"
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </div>
      </div>

      <div className="form-field-group">
        <label>Bio & Player Description</label>
        <textarea
          rows={3}
          value={form.bio}
          placeholder="Brief esports background, main weapons, playstyle..."
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />
      </div>

      <div className="form-field-group">
        <label>Avatar Image URL (Optional)</label>
        <input
          type="url"
          value={form.avatarUrl}
          placeholder="https://..."
          onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
        />
      </div>

      <button className="button primary-button" type="submit" disabled={saving} style={{ alignSelf: 'flex-start' }}>
        {saving ? 'Saving...' : 'Save Profile Details'}
      </button>
    </form>
  );
}

function PrivacyControlsForm({ privacy, onSaved }) {
  const [controls, setControls] = useState({
    isPublic: privacy?.isPublic ?? true,
    showGameUid: privacy?.showGameUid ?? false,
    showTeam: privacy?.showTeam ?? true,
    showPerformance: privacy?.showPerformance ?? true,
    showTournaments: privacy?.showTournaments ?? true,
    showPractice: privacy?.showPractice ?? true,
    showAchievements: privacy?.showAchievements ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleToggle = (key) => {
    setControls((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateMyEsportsProfile(controls);
      onSaved();
    } catch (err) {
      alert('Error saving privacy controls: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="privacy-toggle-item">
        <div className="privacy-toggle-info">
          <strong>Public Profile Searchable</strong>
          <span>Allow other players to discover your profile via EVOQ ID.</span>
        </div>
        <input
          type="checkbox"
          checked={controls.isPublic}
          onChange={() => handleToggle('isPublic')}
        />
      </div>

      <div className="privacy-toggle-item">
        <div className="privacy-toggle-info">
          <strong>Display Game UID Publicly</strong>
          <span>Expose in-game numerical UID on your public player resume.</span>
        </div>
        <input
          type="checkbox"
          checked={controls.showGameUid}
          onChange={() => handleToggle('showGameUid')}
        />
      </div>

      <div className="privacy-toggle-item">
        <div className="privacy-toggle-info">
          <strong>Show Current Esports Team</strong>
          <span>Display your active team membership publicly.</span>
        </div>
        <input
          type="checkbox"
          checked={controls.showTeam}
          onChange={() => handleToggle('showTeam')}
        />
      </div>

      <div className="privacy-toggle-item">
        <div className="privacy-toggle-info">
          <strong>Show Performance Analytics</strong>
          <span>Display kill/damage stats and rating on your public page.</span>
        </div>
        <input
          type="checkbox"
          checked={controls.showPerformance}
          onChange={() => handleToggle('showPerformance')}
        />
      </div>

      <div className="privacy-toggle-item">
        <div className="privacy-toggle-info">
          <strong>Show Tournament History</strong>
          <span>Display official EVOQ tournaments and finishes.</span>
        </div>
        <input
          type="checkbox"
          checked={controls.showTournaments}
          onChange={() => handleToggle('showTournaments')}
        />
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <button className="button primary-button" type="button" disabled={saving} onClick={handleSave}>
          {saving ? 'Saving...' : 'Save Privacy Settings'}
        </button>
      </div>
    </div>
  );
}

function GameProfileModal({ editingGame, onClose, onSuccess }) {
  const [selectedGame, setSelectedGame] = useState(editingGame?.gameName || 'Free Fire');
  const [ign, setIgn] = useState(editingGame?.inGameName || '');
  const [uid, setUid] = useState(editingGame?.gameUid || '');
  const [role, setRole] = useState(editingGame?.primaryRole || '');
  const [secondaryRole, setSecondaryRole] = useState(editingGame?.secondaryRole || '');
  const [startDate, setStartDate] = useState(editingGame?.startedPlayingAt ? editingGame.startedPlayingAt.split('T')[0] : '');
  const [rank, setRank] = useState(editingGame?.currentRank || '');
  const [isPrimary, setIsPrimary] = useState(editingGame?.isPrimary ?? false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const roles = getRolesForGame(selectedGame);
  const ranks = getRanksForGame(selectedGame);

  useEffect(() => {
    if (!editingGame && roles.length > 0 && !role) {
      setRole(roles[0]);
    }
  }, [editingGame, roles, role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErr('');

      const payload = {
        gameName: selectedGame,
        inGameName: ign,
        gameUid: uid,
        primaryRole: role,
        secondaryRole: secondaryRole || null,
        startedPlayingAt: startDate || null,
        currentRank: rank || null,
        isPrimary,
      };

      if (editingGame) {
        await updateGameProfile(editingGame.id, payload);
      } else {
        await createGameProfile(payload);
      }
      onSuccess();
    } catch (error) {
      const n = normalizeApiError(error);
      setErr(n.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-dialog">
        <div className="modal-head">
          <h3>{editingGame ? `Edit ${editingGame.gameName} Profile` : 'Add Game Profile'}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        {err && <div className="dashboard-error"><span>{err}</span></div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-field-group">
            <label>Select Esports Title</label>
            <select
              value={selectedGame}
              disabled={Boolean(editingGame)}
              onChange={(e) => {
                setSelectedGame(e.target.value);
                const r = getRolesForGame(e.target.value);
                setRole(r[0] || '');
              }}
            >
              {SUPPORTED_GAMES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div className="form-row-2">
            <div className="form-field-group">
              <label>In-Game Name (IGN)</label>
              <input
                type="text"
                placeholder="e.g. Sn1perKing"
                value={ign}
                onChange={(e) => setIgn(e.target.value)}
                required
              />
            </div>
            <div className="form-field-group">
              <label>Game UID</label>
              <input
                type="text"
                placeholder="e.g. 123456789"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-field-group">
              <label>Primary Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} required>
                {roles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="form-field-group">
              <label>Secondary Role (Optional)</label>
              <select value={secondaryRole} onChange={(e) => setSecondaryRole(e.target.value)}>
                <option value="">None</option>
                {roles.filter((r) => r !== role).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-field-group">
              <label>Started Playing Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-field-group">
              <label>Current Rank / Tier</label>
              {ranks.length > 0 ? (
                <select value={rank} onChange={(e) => setRank(e.target.value)}>
                  <option value="">Select Rank</option>
                  {ranks.map((rk) => (
                    <option key={rk} value={rk}>{rk}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="e.g. Diamond"
                  value={rank}
                  onChange={(e) => setRank(e.target.value)}
                />
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <input
              type="checkbox"
              id="primaryCheck"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
            />
            <label htmlFor="primaryCheck" style={{ fontSize: '0.85rem', color: '#f6f8fb', cursor: 'pointer' }}>
              Set as primary game profile (displayed on overview and resume)
            </label>
          </div>

          <div className="modal-actions">
            {editingGame && (
              <button
                type="button"
                className="button secondary-button"
                style={{ color: '#e74c3c', marginRight: 'auto' }}
                onClick={async () => {
                  if (window.confirm('Delete this game profile?')) {
                    await deleteGameProfile(editingGame.id);
                    onSuccess();
                  }
                }}
              >
                Delete Game Profile
              </button>
            )}
            <button type="button" className="button secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button primary-button" disabled={saving}>
              {saving ? 'Saving...' : editingGame ? 'Update Game Profile' : 'Save Game Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PracticeSessionModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    sessionDate: new Date().toISOString().split('T')[0],
    gameName: 'Free Fire',
    title: '',
    teamName: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErr('');
      await createPracticeSession(form);
      onSuccess();
    } catch (error) {
      const n = normalizeApiError(error);
      setErr(n.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-dialog">
        <div className="modal-head">
          <h3>Create Practice / Scrim Session</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        {err && <div className="dashboard-error"><span>{err}</span></div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-field-group">
            <label>Session Title / Lobby Name</label>
            <input
              type="text"
              placeholder="e.g. Daily Scrims Tier 1 Lobby"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div className="form-row-2">
            <div className="form-field-group">
              <label>Game</label>
              <select
                value={form.gameName}
                onChange={(e) => setForm({ ...form, gameName: e.target.value })}
              >
                {SUPPORTED_GAMES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="form-field-group">
              <label>Date</label>
              <input
                type="date"
                value={form.sessionDate}
                onChange={(e) => setForm({ ...form, sessionDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-field-group">
            <label>Team Name (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Squad Alpha"
              value={form.teamName}
              onChange={(e) => setForm({ ...form, teamName: e.target.value })}
            />
          </div>

          <div className="form-field-group">
            <label>Notes / Observations</label>
            <textarea
              rows={2}
              placeholder="Rotation strategy notes, drop spot observations..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="button secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="button primary-button" disabled={saving}>
              {saving ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PracticeMatchModal({ sessionId, editingMatch, onClose, onSuccess }) {
  const [form, setForm] = useState({
    matchNumber: editingMatch?.match_number || 1,
    placement: editingMatch?.placement ?? '',
    kills: editingMatch?.kills ?? 0,
    assists: editingMatch?.assists ?? 0,
    damage: editingMatch?.damage ?? 0,
    notes: editingMatch?.notes || '',
    primaryWeapon: '',
    primaryWeaponKills: 0,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErr('');

      const weapons = form.primaryWeapon
        ? [{ weaponName: form.primaryWeapon, kills: Number(form.primaryWeaponKills || 0) }]
        : [];

      const payload = {
        sessionId,
        matchNumber: Number(form.matchNumber),
        placement: form.placement !== '' ? Number(form.placement) : null,
        kills: Number(form.kills || 0),
        assists: Number(form.assists || 0),
        damage: Number(form.damage || 0),
        notes: form.notes || null,
        weapons,
      };

      if (editingMatch) {
        await updatePracticeMatch(editingMatch.id, payload);
      } else {
        await createPracticeMatch(sessionId, payload);
      }
      onSuccess();
    } catch (error) {
      const n = normalizeApiError(error);
      setErr(n.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-dialog">
        <div className="modal-head">
          <h3>{editingMatch ? 'Edit Practice Match' : 'Add Match to Session'}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        {err && <div className="dashboard-error"><span>{err}</span></div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-row-2">
            <div className="form-field-group">
              <label>Match Number</label>
              <input
                type="number"
                min="1"
                value={form.matchNumber}
                onChange={(e) => setForm({ ...form, matchNumber: e.target.value })}
                required
              />
            </div>
            <div className="form-field-group">
              <label>Placement / Rank</label>
              <input
                type="number"
                min="1"
                max="100"
                placeholder="e.g. 1 (Winner), 2, 3..."
                value={form.placement}
                onChange={(e) => setForm({ ...form, placement: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-field-group">
              <label>Kills</label>
              <input
                type="number"
                min="0"
                value={form.kills}
                onChange={(e) => setForm({ ...form, kills: e.target.value })}
                required
              />
            </div>
            <div className="form-field-group">
              <label>Damage Dealt</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 1250"
                value={form.damage}
                onChange={(e) => setForm({ ...form, damage: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-field-group">
              <label>Assists (Optional)</label>
              <input
                type="number"
                min="0"
                value={form.assists}
                onChange={(e) => setForm({ ...form, assists: e.target.value })}
              />
            </div>
            <div className="form-field-group">
              <label>Primary Weapon (Optional)</label>
              <input
                type="text"
                placeholder="e.g. M1887, AWM, Vandal"
                value={form.primaryWeapon}
                onChange={(e) => setForm({ ...form, primaryWeapon: e.target.value })}
              />
            </div>
          </div>

          <div className="form-field-group">
            <label>Match Notes</label>
            <input
              type="text"
              placeholder="e.g. Final circle clutch, good team flank"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="button secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="button primary-button" disabled={saving}>
              {saving ? 'Saving...' : 'Save Match Result'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GuidedSetupWizardModal({ profile, onClose, onComplete }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Form states across steps
  const [basic, setBasic] = useState({
    name: profile?.identity?.name || '',
    country: profile?.identity?.country || '',
    city: profile?.identity?.city || '',
    bio: profile?.identity?.bio || '',
  });

  const [game, setGame] = useState({
    gameName: profile?.primaryGame?.gameName || 'Free Fire',
    inGameName: profile?.primaryGame?.inGameName || '',
    gameUid: profile?.primaryGame?.gameUid || '',
    primaryRole: profile?.primaryGame?.primaryRole || 'IGL',
    startedPlayingAt: profile?.primaryGame?.startedPlayingAt ? profile.primaryGame.startedPlayingAt.split('T')[0] : '',
    isPrimary: true,
  });

  const roles = getRolesForGame(game.gameName);

  const handleNext = async () => {
    setErr('');
    if (step === 1) {
      if (!basic.name.trim()) {
        setErr('Display name is required');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!game.inGameName.trim() || !game.gameUid.trim()) {
        setErr('In-game name and Game UID are required');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      try {
        setSaving(true);
        // Save basic profile
        await updateMyEsportsProfile({
          name: basic.name,
          country: basic.country,
          city: basic.city,
          bio: basic.bio,
        });

        // Save game profile
        if (profile?.primaryGame?.id) {
          await updateGameProfile(profile.primaryGame.id, game);
        } else {
          await createGameProfile(game);
        }

        onComplete();
      } catch (error) {
        const n = normalizeApiError(error);
        setErr(n.message);
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-dialog">
        <div className="modal-head">
          <h3>Complete Your EVOQ Player Profile</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        {/* Step Tracker */}
        <div className="wizard-step-tracker">
          <div className={`wizard-step-node ${step === 1 ? 'active' : ''}`}>
            <span className="wizard-step-num">1</span>
            <span>Identity</span>
          </div>
          <div className={`wizard-step-node ${step === 2 ? 'active' : ''}`}>
            <span className="wizard-step-num">2</span>
            <span>Game & UID</span>
          </div>
          <div className={`wizard-step-node ${step === 3 ? 'active' : ''}`}>
            <span className="wizard-step-num">3</span>
            <span>Role & Exp</span>
          </div>
        </div>

        {err && <div className="dashboard-error"><span>{err}</span></div>}

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-field-group">
              <label>Player Display Name</label>
              <input
                type="text"
                value={basic.name}
                onChange={(e) => setBasic({ ...basic, name: e.target.value })}
                required
              />
            </div>
            <div className="form-row-2">
              <div className="form-field-group">
                <label>Country</label>
                <input
                  type="text"
                  placeholder="e.g. India"
                  value={basic.country}
                  onChange={(e) => setBasic({ ...basic, country: e.target.value })}
                />
              </div>
              <div className="form-field-group">
                <label>City</label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai"
                  value={basic.city}
                  onChange={(e) => setBasic({ ...basic, city: e.target.value })}
                />
              </div>
            </div>
            <div className="form-field-group">
              <label>Player Bio</label>
              <textarea
                rows={2}
                placeholder="Brief bio or competitive experience..."
                value={basic.bio}
                onChange={(e) => setBasic({ ...basic, bio: e.target.value })}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-field-group">
              <label>Primary Esports Game</label>
              <select
                value={game.gameName}
                onChange={(e) => {
                  setGame({ ...game, gameName: e.target.value, primaryRole: getRolesForGame(e.target.value)[0] || 'IGL' });
                }}
              >
                {SUPPORTED_GAMES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="form-row-2">
              <div className="form-field-group">
                <label>In-Game Name (IGN)</label>
                <input
                  type="text"
                  placeholder="e.g. HunterX"
                  value={game.inGameName}
                  onChange={(e) => setGame({ ...game, inGameName: e.target.value })}
                  required
                />
              </div>
              <div className="form-field-group">
                <label>Game UID</label>
                <input
                  type="text"
                  placeholder="e.g. 123456789"
                  value={game.gameUid}
                  onChange={(e) => setGame({ ...game, gameUid: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-field-group">
              <label>Primary Role in {game.gameName}</label>
              <select
                value={game.primaryRole}
                onChange={(e) => setGame({ ...game, primaryRole: e.target.value })}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="form-field-group">
              <label>When did you start playing competitively?</label>
              <input
                type="date"
                value={game.startedPlayingAt}
                onChange={(e) => setGame({ ...game, startedPlayingAt: e.target.value })}
              />
              <small style={{ color: '#8b949e', marginTop: '2px' }}>
                Used to compute and display your verified gaming experience.
              </small>
            </div>
          </div>
        )}

        <div className="modal-actions">
          {step > 1 && (
            <button
              type="button"
              className="button secondary-button"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          )}
          <button type="button" className="button secondary-button" onClick={onClose}>
            Skip for now
          </button>
          <button
            type="button"
            className="button primary-button"
            disabled={saving}
            onClick={handleNext}
          >
            {saving ? 'Finalizing...' : step === 3 ? 'Complete Setup' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  );
}
