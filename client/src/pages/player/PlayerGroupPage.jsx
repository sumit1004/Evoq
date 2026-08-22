import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { fetchGroup, fetchGroupLeaderboard, fetchGroupMatches, fetchResults } from '../../services/competitionApi.js';
import { useSocket } from '../../context/SocketContext.jsx';
import { GroupOverviewView } from '../../components/player/GroupOverviewView.jsx';
import { GroupMatchesView } from '../../components/player/GroupMatchesView.jsx';
import { GroupLeaderboardView } from '../../components/player/GroupLeaderboardView.jsx';
import { GroupChatView } from '../../components/GroupChatView.jsx';

const SUBTABS = ['overview', 'matches', 'leaderboard', 'chat'];

export function PlayerGroupPage() {
  const { groupId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { joinGroup, leaveGroup, on } = useSocket();

  const activeSubtab = SUBTABS.includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'overview';

  const setTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  };

  const [group, setGroup] = useState(null);
  const [matches, setMatches] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [expandedResults, setExpandedResults] = useState({});
  const [matchResults, setMatchResults] = useState({});
  const [state, setState] = useState({ loading: true, error: '' });

  const loadData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const [groupRes, matchesRes, leaderRes] = await Promise.allSettled([
        fetchGroup(groupId),
        fetchGroupMatches(groupId),
        fetchGroupLeaderboard(groupId),
      ]);

      if (groupRes.status === 'fulfilled') {
        setGroup(groupRes.value.group);
      } else {
        throw new Error('Group not found or access denied.');
      }

      if (matchesRes.status === 'fulfilled') {
        setMatches(matchesRes.value.matches || []);
      }
      if (leaderRes.status === 'fulfilled') {
        setLeaderboard(leaderRes.value.leaderboard || []);
      }

      setState({ loading: false, error: '' });
    } catch (error) {
      setState({ loading: false, error: error.message });
    }
  }, [groupId]);

  useEffect(() => {
    joinGroup(groupId);
    loadData();

    const removeRoom = on('room_update', (next) => {
      if (String(next.id) === String(groupId)) setGroup((prev) => ({ ...prev, ...next }));
    });

    const removeMatch = on('match_update', (updatedMatch) => {
      setMatches((prev) =>
        prev.map((m) => (m.id === updatedMatch.id ? { ...m, ...updatedMatch } : m))
      );
    });

    const removeLeader = on('leaderboard_update', () => {
      fetchGroupLeaderboard(groupId).then((res) => {
        setLeaderboard(res.leaderboard || []);
      }).catch(() => {});
    });

    return () => {
      leaveGroup(groupId);
      removeRoom();
      removeMatch();
      removeLeader();
    };
  }, [groupId, joinGroup, leaveGroup, loadData, on]);

  const toggleResult = async (matchId) => {
    const isExpanded = expandedResults[matchId];
    setExpandedResults((prev) => ({ ...prev, [matchId]: !isExpanded }));

    if (!isExpanded && !matchResults[matchId]) {
      try {
        const res = await fetchResults(matchId);
        setMatchResults((prev) => ({ ...prev, [matchId]: res.results || [] }));
      } catch (e) {
        console.error('Error fetching results', e);
      }
    }
  };

  if (state.loading) {
    return (
      <section className="workspace-page">
        <p className="status-panel">Loading group operations...</p>
      </section>
    );
  }

  if (!group) {
    return (
      <section className="workspace-page">
        <Link className="text-link" to="/player/dashboard">← Back to dashboard</Link>
        <div className="form-alert" role="alert" style={{ marginTop: '20px' }}>
          {state.error || 'Group not found.'}
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-page">
      <div className="player-breadcrumb" style={{ marginBottom: '15px' }}>
        <Link className="text-link" to="/player/dashboard">Dashboard</Link>
        <span>/</span>
        <span className="breadcrumb-current">{group.name}</span>
      </div>

      <div className="group-workspace-header">
        <div>
          <h1 className="group-title" style={{ fontSize: '28px' }}>{group.name}</h1>
          <span className="group-subtitle">
            Status: <strong className="status-highlight">{group.status.replaceAll('_', ' ')}</strong> · {group.teams?.length || 0} / {group.groupSize || 12} Assigned Teams
          </span>
        </div>

        {/* Subtabs */}
        <div className="group-segmented-nav">
          {SUBTABS.map((sub) => (
            <button
              key={sub}
              className={activeSubtab === sub ? 'button primary-button subtab-btn' : 'button secondary-button subtab-btn'}
              type="button"
              onClick={() => setTab(sub)}
            >
              {sub === 'overview' && 'Group Overview'}
              {sub === 'matches' && `Matches (${matches.length})`}
              {sub === 'leaderboard' && 'Group Standings'}
              {sub === 'chat' && 'Group Chat'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Overview */}
      {activeSubtab === 'overview' && (
        <GroupOverviewView
          group={group}
          playerTeam={group.teams?.[0]}
          onNavigate={(sub) => setTab(sub)}
        />
      )}

      {/* Tab 2: Matches */}
      {activeSubtab === 'matches' && (
        <GroupMatchesView
          matches={matches}
          playerTeam={group.teams?.[0]}
          expandedMatchResults={expandedResults}
          matchResultsData={matchResults}
          onToggleMatchResult={toggleResult}
        />
      )}

      {/* Tab 3: Group Standings */}
      {activeSubtab === 'leaderboard' && (
        <GroupLeaderboardView
          leaderboard={leaderboard}
          playerTeam={group.teams?.[0]}
        />
      )}

      {/* Tab 4: Chat */}
      {activeSubtab === 'chat' && (
        <GroupChatView
          groupId={group.id}
          groupName={group.name}
          isCompleted={group.status === 'COMPLETED'}
        />
      )}
    </section>
  );
}
