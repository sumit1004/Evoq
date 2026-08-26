import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { fetchTournament, fetchRegistrations } from '../../services/tournamentApi.js';
import { fetchAnnouncements } from '../../services/communicationApi.js';
import {
  fetchTournamentGroups,
  fetchTournamentLeaderboard,
  fetchGroupLeaderboard,
  fetchGroupMatches,
  fetchResults,
} from '../../services/competitionApi.js';
import { useSocket } from '../../context/SocketContext.jsx';
import { PlayerTournamentHeader } from '../../components/player/PlayerTournamentHeader.jsx';
import { CurrentMatchCard } from '../../components/player/CurrentMatchCard.jsx';
import { GroupOverviewView } from '../../components/player/GroupOverviewView.jsx';
import { GroupMatchesView } from '../../components/player/GroupMatchesView.jsx';
import { GroupLeaderboardView } from '../../components/player/GroupLeaderboardView.jsx';
import { TournamentLeaderboardView } from '../../components/player/TournamentLeaderboardView.jsx';
import { GroupChatView } from '../../components/GroupChatView.jsx';

const PRIMARY_TABS = ['overview', 'group', 'leaderboard'];
const GROUP_SUBTABS = ['overview', 'matches', 'leaderboard', 'chat'];

export function TournamentHubPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { joinTournament, leaveTournament, on, connected } = useSocket();

  // Navigation URL state
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
  const [registrations, setRegistrations] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [tournamentLeaderboard, setTournamentLeaderboard] = useState([]);
  const [playerGroups, setPlayerGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groupMatches, setGroupMatches] = useState([]);
  const [groupLeaderboard, setGroupLeaderboard] = useState([]);
  const [expandedMatchResults, setExpandedMatchResults] = useState({});
  const [matchResultsData, setMatchResultsData] = useState({});
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);
  const [state, setState] = useState({ loading: true, error: '' });

  // Load Tournament Core Data
  const loadTournamentData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const [tourneyRes, regRes, announceRes, tourneyLeaderRes, groupsRes] = await Promise.allSettled([
        fetchTournament(tournamentId),
        fetchRegistrations(tournamentId),
        fetchAnnouncements(tournamentId),
        fetchTournamentLeaderboard(tournamentId),
        fetchTournamentGroups(tournamentId),
      ]);

      if (tourneyRes.status === 'fulfilled') {
        setTournament(tourneyRes.value.tournament);
      } else {
        throw new Error('Tournament not found or access denied.');
      }

      if (regRes.status === 'fulfilled') {
        setRegistrations(regRes.value.registrations || []);
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

  // Player's Registered Team Context
  const playerTeam = useMemo(() => {
    if (registrations.length > 0) {
      const verified = registrations.find((r) => r.status === 'VERIFIED');
      const reg = verified || registrations[0];
      return { id: reg.teamId, name: reg.teamName, status: reg.status };
    }
    if (activeGroup?.teams?.length > 0) {
      return activeGroup.teams[0];
    }
    return null;
  }, [registrations, activeGroup]);

  // Load Group Specific Data (matches, group leaderboard)
  const loadGroupDetails = useCallback(async (groupId) => {
    if (!groupId) return;
    try {
      const [matchesRes, leaderRes] = await Promise.allSettled([
        fetchGroupMatches(groupId),
        fetchGroupLeaderboard(groupId),
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

  // Socket triggers with proper cleanup
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
      activeGroup?.teams?.some((t) => t.id === item.teamId) ||
      (playerTeam && playerTeam.id === item.teamId)
    );
  }, [tournamentLeaderboard, activeGroup, playerTeam]);

  const isCompleted = tournament?.status === 'COMPLETED';

  if (state.loading) {
    return (
      <section className="workspace-page">
        <div className="status-panel loading-status-box">
          Restoring your EVOQ Tournament Session...
        </div>
      </section>
    );
  }

  if (!tournament) {
    return (
      <section className="workspace-page">
        <Link className="text-link" to="/player/dashboard">← Back to dashboard</Link>
        <div className="form-alert" role="alert" style={{ marginTop: '20px' }}>
          {state.error || 'Tournament details are unavailable.'}
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-page tournament-command-center">
      {/* 1. Header Component */}
      <PlayerTournamentHeader
        tournament={tournament}
        activeGroup={activeGroup}
        playerTeam={playerTeam}
        currentRoundName={activeGroup?.roundNumber ? `Round ${activeGroup.roundNumber}` : null}
        connected={connected}
        playerGroups={playerGroups}
        selectedGroupId={selectedGroupId}
        setSelectedGroupId={setSelectedGroupId}
      />

      {/* 2. Primary Navigation Tabs: ONLY Overview, My Group, Leaderboard */}
      <nav className="hub-tabs player-primary-tabs" aria-label="Tournament navigation" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'overview'}
          className={activeTab === 'overview' ? 'hub-tab active' : 'hub-tab'}
          type="button"
          onClick={() => setTab('overview')}
        >
          Overview
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'group'}
          className={activeTab === 'group' ? 'hub-tab active' : 'hub-tab'}
          type="button"
          onClick={() => setTab('group', activeSubtab)}
        >
          My Group {activeGroup && `(${activeGroup.name})`}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'leaderboard'}
          className={activeTab === 'leaderboard' ? 'hub-tab active' : 'hub-tab'}
          type="button"
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
          {/* Contextual Quick Actions Bar */}
          <div className="quick-actions-bar">
            {activeGroup && (
              <button
                className="button primary-button"
                type="button"
                onClick={() => setTab('group', 'overview')}
              >
                Open {activeGroup.name}
              </button>
            )}
            {activeGroup && (activeGroup.roomId || activeGroup.roomPassword) && (
              <button
                className="button secondary-button"
                type="button"
                onClick={() => setTab('group', 'overview')}
              >
                View Room Credentials
              </button>
            )}
            {currentOrNextMatch && (
              <button
                className="button secondary-button"
                type="button"
                onClick={() => setTab('group', 'matches')}
              >
                Next Match ({currentOrNextMatch.name || `Match ${currentOrNextMatch.matchNumber}`})
              </button>
            )}
            <button
              className="button ghost-button"
              type="button"
              onClick={() => setTab('leaderboard')}
            >
              View Leaderboard
            </button>
          </div>

          {/* Current / Next Match Card */}
          <CurrentMatchCard
            match={currentOrNextMatch}
            activeGroup={activeGroup}
            onOpenMatchDetails={() => setTab('group', 'matches')}
          />

          {/* Quick Stats Grid */}
          <div className="overview-stats-grid">
            <div className="stat-panel-card">
              <span className="stat-label">Your Group</span>
              <strong className="stat-value">{activeGroup ? activeGroup.name : 'Pending Assignment'}</strong>
            </div>
            <div className="stat-panel-card">
              <span className="stat-label">Your Team</span>
              <strong className="stat-value">{playerTeam ? playerTeam.name : 'Registered'}</strong>
            </div>
            <div className="stat-panel-card">
              <span className="stat-label">Tournament Status</span>
              <strong className="stat-value status-text">{tournament.status.replaceAll('_', ' ')}</strong>
            </div>
            <div className="stat-panel-card">
              <span className="stat-label">Your Rank</span>
              <strong className="stat-value rank-text">
                {playerRank ? `#${playerRank.rank} (${playerRank.points} pts)` : 'Unranked'}
              </strong>
            </div>
          </div>

          {/* Latest Announcements */}
          <div className="announcements-section-box">
            <div className="announcements-head-row">
              <h3>Latest Announcements</h3>
              {announcements.length > 3 && (
                <button
                  className="text-button view-all-btn"
                  type="button"
                  onClick={() => setShowAllAnnouncements((v) => !v)}
                >
                  {showAllAnnouncements ? 'Show Recent' : `View All (${announcements.length})`}
                </button>
              )}
            </div>

            {announcements.length === 0 ? (
              <p className="empty-state">No tournament announcements published yet.</p>
            ) : (
              <div className="announcement-list">
                {(showAllAnnouncements ? announcements : announcements.slice(0, 3)).map((item) => (
                  <article className="announcement-card-item" key={item.id}>
                    <div className="announcement-item-body">
                      <div className="announcement-author-row">
                        <span className="author-name">{item.creatorName}</span>
                        <span className="author-tag">ORGANIZER</span>
                      </div>
                      <p className="announcement-text">{item.message}</p>
                    </div>
                    <time className="announcement-time" dateTime={item.createdAt}>
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
      {/* TAB 2: MY GROUP (OPERATIONAL WORKSPACE) */}
      {/* ========================================================================= */}
      {activeTab === 'group' && (
        <div className="my-group-container">
          {!activeGroup ? (
            <div className="empty-group-state">
              <h3>Your group has not been assigned yet</h3>
              <p>
                Once the organizer opens Round 1 and assigns your team, your room details, match schedules, group leaderboard, and team chat will appear here.
              </p>
            </div>
          ) : (
            <>
              {/* Group Sub-Navigation Header */}
              <div className="group-workspace-header">
                <div>
                  <h2 className="group-title">{activeGroup.name}</h2>
                  <span className="group-subtitle">
                    Status: <strong className="status-highlight">{activeGroup.status.replaceAll('_', ' ')}</strong> · Assigned Teams: <strong>{activeGroup.teams?.length || 0}</strong> / {activeGroup.groupSize || 12}
                  </span>
                </div>

                {/* Subtabs Segmented Bar */}
                <div className="group-segmented-nav">
                  {GROUP_SUBTABS.map((sub) => (
                    <button
                      key={sub}
                      className={activeSubtab === sub ? 'button primary-button subtab-btn' : 'button secondary-button subtab-btn'}
                      type="button"
                      onClick={() => setSubtab(sub)}
                    >
                      {sub === 'overview' && 'Group Overview'}
                      {sub === 'matches' && `Matches (${groupMatches.length || activeGroup.matches?.length || 0})`}
                      {sub === 'leaderboard' && 'Group Standings'}
                      {sub === 'chat' && 'Group Chat'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subtab 1: Group Overview */}
              {activeSubtab === 'overview' && (
                <GroupOverviewView
                  group={activeGroup}
                  playerTeam={playerTeam}
                  onNavigate={(sub) => setSubtab(sub)}
                />
              )}

              {/* Subtab 2: Matches inside Group */}
              {activeSubtab === 'matches' && (
                <GroupMatchesView
                  matches={groupMatches.length ? groupMatches : activeGroup.matches}
                  playerTeam={playerTeam}
                  expandedMatchResults={expandedMatchResults}
                  matchResultsData={matchResultsData}
                  onToggleMatchResult={toggleMatchResult}
                />
              )}

              {/* Subtab 3: Group Standings */}
              {activeSubtab === 'leaderboard' && (
                <GroupLeaderboardView
                  leaderboard={groupLeaderboard}
                  playerTeam={playerTeam}
                />
              )}

              {/* Subtab 4: Group Chat */}
              {activeSubtab === 'chat' && (
                <GroupChatView
                  groupId={activeGroup.id}
                  groupName={activeGroup.name}
                  isCompleted={isCompleted}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: TOURNAMENT LEADERBOARD (OVERALL STANDINGS) */}
      {/* ========================================================================= */}
      {activeTab === 'leaderboard' && (
        <TournamentLeaderboardView
          leaderboard={tournamentLeaderboard}
          playerTeam={playerTeam}
          isCompleted={isCompleted}
        />
      )}
    </section>
  );
}
