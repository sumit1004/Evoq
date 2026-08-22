import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { fetchGroup, fetchGroupLeaderboard, fetchGroupMatches, fetchResults } from '../../services/competitionApi.js';
import { useSocket } from '../../context/SocketContext.jsx';
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
  const [copiedField, setCopiedField] = useState(null);
  const [state, setState] = useState({ loading: true, error: '' });

  const handleCopy = (text, field) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

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
        <Link className="text-link" to="/player/dashboard">Back to dashboard</Link>
        <div className="form-alert" role="alert" style={{ marginTop: '20px' }}>
          {state.error || 'Group not found.'}
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-page">
      <Link className="text-link" to="/player/dashboard">Back to dashboard</Link>
      <div className="page-kicker" style={{ marginTop: '10px' }}>Assigned Group Operations</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '32px' }}>{group.name}</h1>
          <p style={{ margin: '5px 0 0 0', color: '#91a0b3' }}>
            Status: <strong style={{ color: '#7dd3fc' }}>{group.status.replaceAll('_', ' ')}</strong> · {group.teams?.length || 0} / {group.groupSize || 12} Assigned Teams
          </p>
        </div>

        {/* Subtabs */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {SUBTABS.map((sub) => (
            <button
              key={sub}
              className={activeSubtab === sub ? 'button primary-button' : 'button secondary-button'}
              style={{ minHeight: '38px', padding: '0 14px', fontSize: '13px' }}
              onClick={() => setTab(sub)}
            >
              {sub === 'overview' && 'Overview'}
              {sub === 'matches' && `Matches (${matches.length})`}
              {sub === 'leaderboard' && 'Group Standings'}
              {sub === 'chat' && 'Group Chat'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Overview */}
      {activeSubtab === 'overview' && (
        <div>
          {/* Room Card */}
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
                {group.roomId ? 'ROOM READY' : 'PENDING ORGANIZER'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px' }}>
                <span style={{ fontSize: '12px', color: '#91a0b3', display: 'block', marginBottom: '4px' }}>ROOM ID</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '18px', color: '#fff', letterSpacing: '1px' }}>{group.roomId || 'Not set'}</strong>
                  {group.roomId && (
                    <button className="button secondary-button" style={{ minHeight: '26px', padding: '0 8px', fontSize: '11px' }} onClick={() => handleCopy(group.roomId, 'roomId')}>
                      {copiedField === 'roomId' ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px' }}>
                <span style={{ fontSize: '12px', color: '#91a0b3', display: 'block', marginBottom: '4px' }}>PASSWORD</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '18px', color: '#f6c453', letterSpacing: '1px' }}>{group.roomPassword || 'Not set'}</strong>
                  {group.roomPassword && (
                    <button className="button secondary-button" style={{ minHeight: '26px', padding: '0 8px', fontSize: '11px' }} onClick={() => handleCopy(group.roomPassword, 'roomPass')}>
                      {copiedField === 'roomPass' ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Assigned Teams */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', color: '#fff', marginBottom: '10px' }}>Assigned Teams ({group.teams?.length || 0})</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              {group.teams?.map((team) => (
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

      {/* Tab 2: Matches */}
      {activeSubtab === 'matches' && (
        <div>
          {matches.length === 0 ? (
            <p className="empty-state">No matches scheduled for this group yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {matches.map((match) => {
                const isExpanded = expandedResults[match.id];
                const results = matchResults[match.id] || [];

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
                            onClick={() => toggleResult(match.id)}
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

                    {isExpanded && (
                      <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <h5 style={{ margin: '0 0 10px 0', color: '#7dd3fc', fontSize: '14px' }}>Match Scoreboard & Results</h5>
                        {results.length === 0 ? (
                          <p className="empty-state" style={{ margin: 0, padding: '10px' }}>Loading match results...</p>
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

      {/* Tab 3: Group Standings */}
      {activeSubtab === 'leaderboard' && (
        <div>
          {leaderboard.length === 0 ? (
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
                  {leaderboard.map((row, index) => (
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
