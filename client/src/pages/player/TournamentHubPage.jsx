import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { fetchTournament } from '../../services/tournamentApi.js';
import { fetchAnnouncements } from '../../services/communicationApi.js';
import {
  fetchTournamentGroups,
  fetchTournamentLeaderboard,
  fetchGroupLeaderboard,
  fetchGroupMatches,
  fetchResults
} from '../../services/competitionApi.js';
import { useSocket } from '../../context/SocketContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { GroupChatView } from '../../components/GroupChatView.jsx';

const PRIMARY_TABS = ['overview', 'group', 'leaderboard'];
const GROUP_SUBTABS = ['overview', 'matches', 'leaderboard', 'chat'];

export function TournamentHubPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { identity } = useAuth();
  const { joinTournament, leaveTournament, on, connected } = useSocket();

  // URL state management
  const activeTab = PRIMARY_TABS.includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'overview';
  const activeSubtab = GROUP_SUBTABS.includes(searchParams.get('subtab'))
    ? searchParams.get('subtab')
    : 'overview';

  const setTab = (tab, subtab = null) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    if (subtab) {
      next.set('subtab', subtab);
    } else if (tab !== 'group') {
      next.delete('subtab');
    }
    setSearchParams(next);
  };

  const setSubtab = (subtab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'group');
    next.set('subtab', subtab);
    setSearchParams(next);
  };

  // State
  const [tournament, setTournament] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [tournamentLeaderboard, setTournamentLeaderboard] = useState([]);
  const [playerGroups, setPlayerGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groupMatches, setGroupMatches] = useState([]);
  const [groupLeaderboard, setGroupLeaderboard] = useState([]);
  const [expandedMatchResults, setExpandedMatchResults] = useState({});
  const [matchResultsData, setMatchResultsData] = useState({});
  const [copiedField, setCopiedField] = useState(null);
  const [state, setState] = useState({ loading: true, error: '' });

  // Copy helper
  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  // Load Tournament Core Data
  const loadTournamentData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const [tourneyRes, announceRes, tourneyLeaderRes, groupsRes] = await Promise.allSettled([
        fetchTournament(tournamentId),
        fetchAnnouncements(tournamentId),
        fetchTournamentLeaderboard(tournamentId),
        fetchTournamentGroups(tournamentId)
      ]);

      if (tourneyRes.status === 'fulfilled') {
        setTournament(tourneyRes.value.tournament);
      } else {
        throw new Error('Tournament not found or access denied.');
      }

      if (announceRes.status === 'fulfilled') {
        setAnnouncements(announceRes.value.announcements || []);
      }
      if (tourneyLeaderRes.status === 'fulfilled') {
        setTournamentLeaderboard(tourneyLeaderRes.value.leaderboard || []);
      }

      const groups = groupsRes.status === 'fulfilled' ? (groupsRes.value.groups || []) : [];
      setPlayerGroups(groups);
      if (groups.length > 0) {
        setSelectedGroupId((prev) => prev || groups[groups.length - 1].id);
      }

      setState({ loading: false, error: '' });
    } catch (error) {
      setState({ loading: false, error: error.message });
    }
  }, [tournamentId]);

  // Active Assigned Group
  const activeGroup = useMemo(() => {
    if (!playerGroups.length) return null;
    if (selectedGroupId) {
      return playerGroups.find((g) => g.id === Number(selectedGroupId)) || playerGroups[0];
    }
    return playerGroups[playerGroups.length - 1];
  }, [playerGroups, selectedGroupId]);

  // Load Group Specific Data (matches, group leaderboard)
  const loadGroupDetails = useCallback(async (groupId) => {
    if (!groupId) return;
    try {
      const [matchesRes, leaderRes] = await Promise.allSettled([
        fetchGroupMatches(groupId),
        fetchGroupLeaderboard(groupId)
      ]);

      if (matchesRes.status === 'fulfilled') {
        setGroupMatches(matchesRes.value.matches || []);
      }
      if (leaderRes.status === 'fulfilled') {
        setGroupLeaderboard(leaderRes.value.leaderboard || []);
      }
    } catch (e) {
      console.error('Error loading group details', e);
    }
  }, []);

  useEffect(() => {
    if (activeGroup?.id) {
      loadGroupDetails(activeGroup.id);
    }
  }, [activeGroup?.id, loadGroupDetails]);

  // Toggle match results expansion
  const toggleMatchResult = async (matchId) => {
    const isExpanded = expandedMatchResults[matchId];
    setExpandedMatchResults((prev) => ({ ...prev, [matchId]: !isExpanded }));

    if (!isExpanded && !matchResultsData[matchId]) {
      try {
        const res = await fetchResults(matchId);
        setMatchResultsData((prev) => ({ ...prev, [matchId]: res.results || [] }));
      } catch (e) {
        console.error('Error fetching match results', e);
      }
    }
  };

  // Socket triggers
  useEffect(() => {
    joinTournament(tournamentId);
    loadTournamentData();

    const removeAnnounce = on('announcement', (item) => {
      setAnnouncements((prev) => [item, ...prev.filter((a) => a.id !== item.id)]);
    });

    const removeLeaderboard = on('leaderboard_update', () => {
      fetchTournamentLeaderboard(tournamentId).then((res) => {
        setTournamentLeaderboard(res.leaderboard || []);
      }).catch(() => {});
      if (activeGroup?.id) {
        fetchGroupLeaderboard(activeGroup.id).then((res) => {
          setGroupLeaderboard(res.leaderboard || []);
        }).catch(() => {});
      }
    });

    const removeRoomUpdate = on('room_update', (updatedGroup) => {
      setPlayerGroups((prev) =>
        prev.map((g) => (g.id === updatedGroup.id ? { ...g, ...updatedGroup } : g))
      );
    });

    const removeMatchUpdate = on('match_update', (updatedMatch) => {
      setGroupMatches((prev) =>
        prev.map((m) => (m.id === updatedMatch.id ? { ...m, ...updatedMatch } : m))
      );
    });

    return () => {
      leaveTournament(tournamentId);
      removeAnnounce();
      removeLeaderboard();
      removeRoomUpdate();
      removeMatchUpdate();
    };
  }, [tournamentId, joinTournament, leaveTournament, loadTournamentData, on, activeGroup?.id]);

  // Current / Next Match in player's group
  const currentOrNextMatch = useMemo(() => {
    const matches = groupMatches.length ? groupMatches : activeGroup?.matches || [];
    const live = matches.find((m) => m.status === 'LIVE');
    if (live) return live;
    const scheduled = matches.find((m) => m.status === 'SCHEDULED');
    if (scheduled) return scheduled;
    return matches.at(-1) || null;
  }, [groupMatches, activeGroup]);

  // Player's Rank in Leaderboard
  const playerRank = useMemo(() => {
    if (!tournamentLeaderboard.length) return null;
    return tournamentLeaderboard.find((item) =>
      activeGroup?.teams?.some((t) => t.id === item.teamId)
    );
  }, [tournamentLeaderboard, activeGroup]);

  const isCompleted = tournament?.status === 'COMPLETED';

  if (state.loading) {
    return (
      <section className="workspace-page">
        <div className="status-panel" style={{ padding: '40px', textAlign: 'center' }}>
          Restoring your EVOQ Tournament Session...
        </div>
      </section>
    );
  }

  if (!tournament) {
    return (
      <section className="workspace-page">
        <Link className="text-link" to="/player/dashboard">Back to dashboard</Link>
        <div className="form-alert" role="alert" style={{ marginTop: '20px' }}>
          {state.error || 'Tournament details are unavailable.'}
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-page tournament-command-center">
      {/* Contextual Breadcrumb */}
      <div className="command-breadcrumbs" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#91a0b3', marginBottom: '15px' }}>
        <Link className="text-link" to="/player/dashboard">Dashboard</Link>
        <span>/</span>
        <Link className="text-link" to="/tournaments">Tournaments</Link>
        <span>/</span>
        <span style={{ color: '#fff', fontWeight: 'bold' }}>{tournament.name}</span>
      </div>

      {/* Tournament Esports Header */}
      <div className="tournament-hero-card" style={{
        background: 'linear-gradient(180deg, rgba(28, 33, 40, 0.95), rgba(13, 17, 23, 0.98))',
        border: '1px solid rgba(125, 211, 252, 0.15)',
        borderRadius: '10px',
        padding: '24px',
        marginBottom: '20px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span className={`status-badge ${tournament.status.toLowerCase().replaceAll('_', '-')}`} style={{ fontSize: '12px', padding: '4px 10px' }}>
                {tournament.status.replaceAll('_', ' ')}
              </span>
              <span style={{ fontSize: '13px', color: '#7dd3fc', background: 'rgba(125, 211, 252, 0.1)', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                {tournament.game || 'Free Fire'}
              </span>
              {activeGroup && (
                <span style={{ fontSize: '13px', color: '#f6c453', background: 'rgba(246, 196, 83, 0.1)', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                  {activeGroup.name}
                </span>
              )}
            </div>

            <h1 style={{ margin: '0 0 8px 0', fontSize: 'clamp(1.8rem, 2.5rem, 3rem)', color: '#fff' }}>
              {tournament.name}
            </h1>
            <p style={{ margin: 0, color: '#91a0b3', fontSize: '14px', maxWidth: '700px' }}>
              {tournament.description || 'Official EVOQ tournament broadcast and match tracking hub.'}
            </p>
          </div>

          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <span className={`connection-status ${connected ? 'is-connected' : ''}`} style={{ fontSize: '12px' }}>
              {connected ? '● LIVE REALTIME HUB' : '○ OFFLINE'}
            </span>
            <span style={{ fontSize: '13px', color: '#91a0b3' }}>
              Format: <strong>{tournament.playersPerTeam}v{tournament.playersPerTeam}</strong> · Max: <strong>{tournament.maxTeams} teams</strong>
            </span>
            <span style={{ fontSize: '13px', color: '#2ecc71', fontWeight: 'bold' }}>
              Entry: {tournament.entryType === 'PAID' ? `₹${tournament.entryFee}` : 'Free Entry'}
            </span>
          </div>
        </div>

        {/* Multi-group selector if player qualified for multiple rounds */}
        {playerGroups.length > 1 && (
          <div style={{ marginTop: '15px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: '#91a0b3' }}>Your Groups:</span>
            {playerGroups.map((g) => (
              <button
                key={g.id}
                className={selectedGroupId === g.id ? 'button primary-button' : 'button secondary-button'}
                style={{ minHeight: '30px', padding: '0 10px', fontSize: '12px' }}
                onClick={() => setSelectedGroupId(g.id)}
              >
                {g.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Primary Navigation Tabs */}
      <nav className="hub-tabs" aria-label="Tournament navigation" role="tablist" style={{ marginBottom: '20px' }}>
        <button
          role="tab"
          aria-selected={activeTab === 'overview'}
          className={activeTab === 'overview' ? 'hub-tab active' : 'hub-tab'}
          onClick={() => setTab('overview')}
        >
          Overview
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'group'}
          className={activeTab === 'group' ? 'hub-tab active' : 'hub-tab'}
          onClick={() => setTab('group', activeSubtab)}
        >
          My Group {activeGroup && `(${activeGroup.name})`}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'leaderboard'}
          className={activeTab === 'leaderboard' ? 'hub-tab active' : 'hub-tab'}
          onClick={() => setTab('leaderboard')}
        >
          Tournament Leaderboard
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW (PLAYER COMMAND CENTER) */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="overview-container">
          {/* Contextual Quick Actions */}
          <div className="quick-actions-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
            {activeGroup && (
              <button className="button primary-button" onClick={() => setTab('group', 'overview')}>
                ⚔️ Open {activeGroup.name}
              </button>
            )}
            {activeGroup && (activeGroup.roomId || activeGroup.roomPassword) && (
              <button className="button secondary-button" onClick={() => setTab('group', 'overview')}>
                🔑 View Room Credentials
              </button>
            )}
            {currentOrNextMatch && (
              <button className="button secondary-button" onClick={() => setTab('group', 'matches')}>
                🎮 Next Match ({currentOrNextMatch.name || `Match ${currentOrNextMatch.matchNumber}`})
              </button>
            )}
            <button className="button ghost-button" onClick={() => setTab('leaderboard')}>
              🏆 View Leaderboard
            </button>
          </div>

          {/* Current / Next Match Card */}
          <div className="current-match-panel" style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: currentOrNextMatch?.status === 'LIVE' ? '1px solid rgba(46, 204, 113, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="page-kicker" style={{ color: currentOrNextMatch?.status === 'LIVE' ? '#2ecc71' : '#7dd3fc' }}>
                  {currentOrNextMatch?.status === 'LIVE' ? '🔴 LIVE MATCH IN PROGRESS' : 'NEXT SCHEDULED MATCH'}
                </span>
              </div>
              {currentOrNextMatch && (
                <span className={`status-badge ${currentOrNextMatch.status.toLowerCase()}`}>
                  {currentOrNextMatch.status}
                </span>
              )}
            </div>

            {currentOrNextMatch ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '20px', color: '#fff' }}>
                    {currentOrNextMatch.name || `Match #${currentOrNextMatch.matchNumber}`}
                  </h3>
                  <span style={{ fontSize: '13px', color: '#91a0b3' }}>
                    {activeGroup ? activeGroup.name : 'Tournament Group'} · {currentOrNextMatch.scheduledAt ? new Date(currentOrNextMatch.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ready to start'}
                  </span>
                </div>

                {/* Room Access Credentials Box */}
                {activeGroup && (
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#91a0b3' }}>Room ID:</span>
                      <strong style={{ color: '#fff', letterSpacing: '1px' }}>{activeGroup.roomId || 'Pending'}</strong>
                      {activeGroup.roomId && (
                        <button
                          className="button secondary-button"
                          style={{ minHeight: '24px', padding: '0 8px', fontSize: '11px' }}
                          onClick={() => handleCopy(activeGroup.roomId, 'roomId')}
                        >
                          {copiedField === 'roomId' ? 'Copied!' : 'Copy'}
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#91a0b3' }}>Password:</span>
                      <strong style={{ color: '#f6c453', letterSpacing: '1px' }}>{activeGroup.roomPassword || 'Pending'}</strong>
                      {activeGroup.roomPassword && (
                        <button
                          className="button secondary-button"
                          style={{ minHeight: '24px', padding: '0 8px', fontSize: '11px' }}
                          onClick={() => handleCopy(activeGroup.roomPassword, 'roomPass')}
                        >
                          {copiedField === 'roomPass' ? 'Copied!' : 'Copy'}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ textAlign: 'right' }}>
                  <button className="button primary-button" onClick={() => setTab('group', 'matches')}>
                    Open Match Details →
                  </button>
                </div>
              </div>
            ) : (
              <p className="empty-state" style={{ margin: 0, padding: '15px' }}>
                No upcoming match has been scheduled yet for your group.
              </p>
            )}
          </div>

          {/* Quick Stats Grid */}
          <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '25px' }}>
            <div className="detail-panel">
              <strong>Your Assigned Group</strong>
              <span>{activeGroup ? activeGroup.name : 'Pending Assignment'}</span>
            </div>
            <div className="detail-panel">
              <strong>Tournament Status</strong>
              <span>{tournament.status.replaceAll('_', ' ')}</span>
            </div>
            <div className="detail-panel">
              <strong>Current Rank</strong>
              <span>{playerRank ? `#${playerRank.rank} (${playerRank.points} pts)` : 'Unranked'}</span>
            </div>
            <div className="detail-panel">
              <strong>Announcements</strong>
              <span>{announcements.length} Published</span>
            </div>
          </div>

          {/* Recent Tournament Announcements Stream */}
          <div className="announcements-section" style={{ marginTop: '20px' }}>
            <h2 style={{ fontSize: '18px', color: '#fff', marginBottom: '12px' }}>Latest Announcements</h2>
            {announcements.length === 0 ? (
              <p className="empty-state">No tournament announcements published yet.</p>
            ) : (
              <div className="registration-list">
                {announcements.slice(0, 3).map((item) => (
                  <article className="registration-item" key={item.id}>
                    <div>
                      <strong style={{ color: '#7dd3fc' }}>{item.creatorName} (Organizer)</strong>
                      <p style={{ margin: '5px 0 0 0', color: '#f6f8fb' }}>{item.message}</p>
                    </div>
                    <time style={{ fontSize: '12px', color: '#91a0b3' }} dateTime={item.createdAt}>
                      {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MY GROUP (OPERATIONAL AREA) */}
      {/* ========================================================================= */}
      {activeTab === 'group' && (
        <div className="my-group-container">
          {!activeGroup ? (
            <div className="empty-group-state" style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              padding: '40px 20px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '40px', marginBottom: '15px' }}>⏳</div>
              <h3 style={{ color: '#fff', margin: '0 0 10px 0' }}>You haven't been assigned to a group yet</h3>
              <p style={{ color: '#91a0b3', maxWidth: '500px', margin: '0 auto' }}>
                Once the organizer opens Round 1 and assigns your team, your room details, match schedules, group leaderboard, and team chat will appear here.
              </p>
            </div>
          ) : (
            <>
              {/* Group Header Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '15px', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', color: '#fff' }}>{activeGroup.name}</h2>
                  <span style={{ fontSize: '13px', color: '#91a0b3' }}>
                    Status: <strong style={{ color: '#7dd3fc' }}>{activeGroup.status.replaceAll('_', ' ')}</strong> · Assigned Teams: <strong>{activeGroup.teams?.length || 0}</strong> / {activeGroup.groupSize || 12}
                  </span>
                </div>

                {/* Group Subtabs */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {GROUP_SUBTABS.map((sub) => (
                    <button
                      key={sub}
                      className={activeSubtab === sub ? 'button primary-button' : 'button secondary-button'}
                      style={{ minHeight: '36px', padding: '0 12px', fontSize: '13px' }}
                      onClick={() => setSubtab(sub)}
                    >
                      {sub === 'overview' && 'Overview'}
                      {sub === 'matches' && `Matches (${groupMatches.length || activeGroup.matches?.length || 0})`}
                      {sub === 'leaderboard' && 'Group Standings'}
                      {sub === 'chat' && 'Group Chat'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subtab 1: Group Overview */}
              {activeSubtab === 'overview' && (
                <div className="group-overview-panel">
                  {/* Room Credentials Card */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(20, 26, 35, 0.95), rgba(13, 17, 23, 0.95))',
                    border: '1px solid rgba(125, 211, 252, 0.2)',
                    borderRadius: '8px',
                    padding: '20px',
                    marginBottom: '20px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', color: '#7dd3fc' }}>Lobby & Room Credentials</h3>
                      <span className="status-badge live" style={{ fontSize: '11px' }}>
                        {activeGroup.roomId ? 'ROOM READY' : 'WAITING FOR ORGANIZER'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#91a0b3', display: 'block', marginBottom: '4px' }}>ROOM ID</span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '18px', color: '#fff', letterSpacing: '1px' }}>
                            {activeGroup.roomId || 'Not set'}
                          </strong>
                          {activeGroup.roomId && (
                            <button className="button secondary-button" style={{ minHeight: '26px', padding: '0 8px', fontSize: '11px' }} onClick={() => handleCopy(activeGroup.roomId, 'gRoomId')}>
                              {copiedField === 'gRoomId' ? 'Copied!' : 'Copy'}
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#91a0b3', display: 'block', marginBottom: '4px' }}>PASSWORD</span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '18px', color: '#f6c453', letterSpacing: '1px' }}>
                            {activeGroup.roomPassword || 'Not set'}
                          </strong>
                          {activeGroup.roomPassword && (
                            <button className="button secondary-button" style={{ minHeight: '26px', padding: '0 8px', fontSize: '11px' }} onClick={() => handleCopy(activeGroup.roomPassword, 'gRoomPass')}>
                              {copiedField === 'gRoomPass' ? 'Copied!' : 'Copy'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Assigned Teams Grid */}
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '16px', color: '#fff', marginBottom: '10px' }}>Assigned Teams ({activeGroup.teams?.length || 0})</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                      {activeGroup.teams?.map((team) => (
                        <div key={team.id} style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: '6px',
                          padding: '12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#fff' }}>{team.name}</strong>
                          <span style={{ fontSize: '11px', color: '#91a0b3' }}>Confirmed</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 2: Matches inside Group */}
              {activeSubtab === 'matches' && (
                <div className="group-matches-panel">
                  {(!groupMatches.length && !activeGroup.matches?.length) ? (
                    <p className="empty-state">No matches scheduled for this group yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(groupMatches.length ? groupMatches : activeGroup.matches).map((match) => {
                        const isExpanded = expandedMatchResults[match.id];
                        const results = matchResultsData[match.id] || [];

                        return (
                          <div
                            key={match.id}
                            style={{
                              background: 'rgba(255, 255, 255, 0.03)',
                              border: match.status === 'LIVE' ? '1px solid rgba(46, 204, 113, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '8px',
                              padding: '16px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontWeight: 'bold', color: '#7dd3fc', fontSize: '13px' }}>
                                    Match #{match.matchNumber}
                                  </span>
                                  <span className={`status-badge ${match.status.toLowerCase()}`}>
                                    {match.status}
                                  </span>
                                </div>
                                <h4 style={{ margin: '4px 0 0 0', fontSize: '18px', color: '#fff' }}>{match.name}</h4>
                                <span style={{ fontSize: '12px', color: '#91a0b3' }}>
                                  {match.scheduledAt ? new Date(match.scheduledAt).toLocaleString() : 'Schedule pending'}
                                </span>
                              </div>

                              <div>
                                {match.status === 'COMPLETED' ? (
                                  <button
                                    className="button secondary-button"
                                    onClick={() => toggleMatchResult(match.id)}
                                  >
                                    {isExpanded ? 'Hide Results ▲' : 'View Results ▼'}
                                  </button>
                                ) : match.status === 'LIVE' ? (
                                  <span style={{ color: '#2ecc71', fontWeight: 'bold', fontSize: '13px' }}>
                                    ● Match in progress
                                  </span>
                                ) : (
                                  <span style={{ color: '#91a0b3', fontSize: '13px' }}>
                                    Scheduled
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Expandable Match Results Table */}
                            {isExpanded && (
                              <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                <h5 style={{ margin: '0 0 10px 0', color: '#7dd3fc', fontSize: '14px' }}>Match Scoreboard & Results</h5>
                                {results.length === 0 ? (
                                  <p className="empty-state" style={{ margin: 0, padding: '10px' }}>Loading match result scores...</p>
                                ) : (
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                      <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#91a0b3', textAlign: 'left' }}>
                                        <th style={{ padding: '8px' }}>Placement</th>
                                        <th style={{ padding: '8px' }}>Team</th>
                                        <th style={{ padding: '8px' }}>Kills</th>
                                        <th style={{ padding: '8px' }}>Total Points</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {results.map((res, i) => (
                                        <tr key={res.teamId || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                          <td style={{ padding: '8px', fontWeight: 'bold', color: i === 0 ? '#f6c453' : '#fff' }}>
                                            {res.placement || i + 1}
                                          </td>
                                          <td style={{ padding: '8px', color: '#fff' }}>{res.teamName}</td>
                                          <td style={{ padding: '8px', color: '#91a0b3' }}>{res.kills}</td>
                                          <td style={{ padding: '8px', fontWeight: 'bold', color: '#7dd3fc' }}>{res.points}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Subtab 3: Group Standings */}
              {activeSubtab === 'leaderboard' && (
                <div className="group-leaderboard-panel">
                  {groupLeaderboard.length === 0 ? (
                    <p className="empty-state">Group leaderboard will update once match results are recorded.</p>
                  ) : (
                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#91a0b3', fontSize: '13px' }}>
                            <th style={{ padding: '12px 15px' }}>Rank</th>
                            <th style={{ padding: '12px 15px' }}>Team</th>
                            <th style={{ padding: '12px 15px' }}>Kills</th>
                            <th style={{ padding: '12px 15px' }}>Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupLeaderboard.map((row, index) => (
                            <tr key={`${row.teamId}-${index}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding: '12px 15px', fontWeight: 'bold', color: index === 0 ? '#f6c453' : index === 1 ? '#cdd6e2' : index === 2 ? '#d97706' : '#fff' }}>
                                #{row.rank || index + 1}
                              </td>
                              <td style={{ padding: '12px 15px', fontWeight: '500', color: '#fff' }}>
                                {row.teamName}
                              </td>
                              <td style={{ padding: '12px 15px', color: '#91a0b3' }}>{row.kills}</td>
                              <td style={{ padding: '12px 15px', fontWeight: 'bold', color: '#7dd3fc' }}>{row.points}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Subtab 4: Group Chat */}
              {activeSubtab === 'chat' && (
                <div className="group-chat-panel">
                  <GroupChatView
                    groupId={activeGroup.id}
                    groupName={activeGroup.name}
                    isCompleted={isCompleted}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: TOURNAMENT LEADERBOARD (OVERALL STANDINGS) */}
      {/* ========================================================================= */}
      {activeTab === 'leaderboard' && (
        <div className="tournament-leaderboard-container">
          {/* Final Results Podium if tournament completed */}
          {isCompleted && tournamentLeaderboard.length >= 3 && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9))',
              border: '1px solid rgba(246, 196, 83, 0.3)',
              borderRadius: '10px',
              padding: '24px',
              marginBottom: '25px',
              textAlign: 'center'
            }}>
              <span className="page-kicker" style={{ color: '#f6c453', fontSize: '13px' }}>🏆 OFFICIAL TOURNAMENT CHAMPIONS</span>
              <h2 style={{ fontSize: '26px', color: '#fff', margin: '8px 0 20px 0' }}>Final Tournament Results</h2>

              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '20px', flexWrap: 'wrap' }}>
                {/* 2nd place */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '15px', borderRadius: '8px', minWidth: '160px' }}>
                  <div style={{ fontSize: '24px' }}>🥈 2nd Place</div>
                  <strong style={{ fontSize: '18px', color: '#fff', display: 'block', marginTop: '6px' }}>
                    {tournamentLeaderboard[1].teamName}
                  </strong>
                  <span style={{ color: '#91a0b3', fontSize: '13px' }}>{tournamentLeaderboard[1].points} pts · {tournamentLeaderboard[1].kills} kills</span>
                </div>

                {/* 1st place */}
                <div style={{ background: 'rgba(246, 196, 83, 0.1)', border: '1px solid rgba(246, 196, 83, 0.4)', padding: '20px', borderRadius: '8px', minWidth: '200px', transform: 'scale(1.05)' }}>
                  <div style={{ fontSize: '32px' }}>👑 CHAMPION</div>
                  <strong style={{ fontSize: '22px', color: '#f6c453', display: 'block', marginTop: '6px' }}>
                    {tournamentLeaderboard[0].teamName}
                  </strong>
                  <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>{tournamentLeaderboard[0].points} pts · {tournamentLeaderboard[0].kills} kills</span>
                </div>

                {/* 3rd place */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '15px', borderRadius: '8px', minWidth: '160px' }}>
                  <div style={{ fontSize: '24px' }}>🥉 3rd Place</div>
                  <strong style={{ fontSize: '18px', color: '#fff', display: 'block', marginTop: '6px' }}>
                    {tournamentLeaderboard[2].teamName}
                  </strong>
                  <span style={{ color: '#91a0b3', fontSize: '13px' }}>{tournamentLeaderboard[2].points} pts · {tournamentLeaderboard[2].kills} kills</span>
                </div>
              </div>
            </div>
          )}

          {/* Full Tournament Standings Table */}
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
            {tournamentLeaderboard.length === 0 ? (
              <p className="empty-state">No tournament leaderboard data available yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#91a0b3', fontSize: '13px' }}>
                    <th style={{ padding: '12px 15px' }}>Rank</th>
                    <th style={{ padding: '12px 15px' }}>Team</th>
                    <th style={{ padding: '12px 15px' }}>Kills</th>
                    <th style={{ padding: '12px 15px' }}>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {tournamentLeaderboard.map((row, index) => (
                    <tr key={`${row.teamId}-${index}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px 15px', fontWeight: 'bold', color: index === 0 ? '#f6c453' : index === 1 ? '#cdd6e2' : index === 2 ? '#d97706' : '#fff' }}>
                        #{row.rank || index + 1}
                      </td>
                      <td style={{ padding: '12px 15px', fontWeight: '500', color: '#fff' }}>
                        {row.teamName}
                      </td>
                      <td style={{ padding: '12px 15px', color: '#91a0b3' }}>{row.kills}</td>
                      <td style={{ padding: '12px 15px', fontWeight: 'bold', color: '#7dd3fc' }}>{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
