import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  assignTeam,
  completeGroup,
  completeMatch,
  createMatch,
  createResult,
  fetchEligibleTeams,
  fetchGroup,
  fetchGroupLeaderboard,
  fetchGroupMatches,
  fetchResults,
  recalculateLeaderboard,
  removeGroupTeam,
  updateGroup,
  updateMatch
} from '../../services/competitionApi.js';
import { GroupChatView } from '../../components/GroupChatView.jsx';

const GROUP_TABS = ['overview', 'teams', 'matches', 'leaderboard', 'chat'];

export function OrganizerGroupPage() {
  const { tournamentId, groupId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = GROUP_TABS.includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'overview';

  const setTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  };

  // State
  const [group, setGroup] = useState(null);
  const [matches, setMatches] = useState([]);
  const [eligibleTeams, setEligibleTeams] = useState([]);
  const [groupLeaderboard, setGroupLeaderboard] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');

  // Forms
  const [room, setRoom] = useState({ roomId: '', roomPassword: '' });
  const [matchForm, setMatchForm] = useState({ matchNumber: 1, name: 'Match 1' });
  const [scoreModal, setScoreModal] = useState({
    isOpen: false,
    matchId: null,
    matchName: '',
    teamId: '',
    points: 0,
    kills: 0,
    placement: 1,
    resultText: '',
  });

  const [expandedResults, setExpandedResults] = useState({});
  const [matchResults, setMatchResults] = useState({});
  const [state, setState] = useState({ loading: true, submitting: false, error: '', notice: '' });

  // Load Group Workspace Data
  const loadData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '', notice: '' }));
    try {
      const result = await fetchGroup(groupId);
      const grp = result.group;
      setGroup(grp);
      setRoom({ roomId: grp.roomId || '', roomPassword: grp.roomPassword || '' });

      const [matchesRes, leaderRes, eligibleRes] = await Promise.allSettled([
        fetchGroupMatches(groupId),
        fetchGroupLeaderboard(groupId),
        grp.roundId ? fetchEligibleTeams(grp.roundId) : Promise.resolve({ teams: [] }),
      ]);

      if (matchesRes.status === 'fulfilled') {
        const list = matchesRes.value.matches || grp.matches || [];
        setMatches(list);
        setMatchForm({ matchNumber: list.length + 1, name: `Match ${list.length + 1}` });
      }
      if (leaderRes.status === 'fulfilled') {
        setGroupLeaderboard(leaderRes.value.leaderboard || []);
      }
      if (eligibleRes.status === 'fulfilled') {
        setEligibleTeams(eligibleRes.value.teams || []);
      }

      setState({ loading: false, submitting: false, error: '', notice: '' });
    } catch (error) {
      setState({ loading: false, submitting: false, error: error.message, notice: '' });
    }
  }, [groupId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save Room Credentials
  const handleSaveRoom = async (e) => {
    e.preventDefault();
    setState((s) => ({ ...s, submitting: true, error: '', notice: '' }));
    try {
      const result = await updateGroup(groupId, room);
      setGroup(result.group);
      setState({ loading: false, submitting: false, notice: 'Room credentials updated and broadcasted.', error: '' });
    } catch (error) {
      setState({ loading: false, submitting: false, error: error.message, notice: '' });
    }
  };

  // Start / Complete Group
  const handleStartGroup = async () => {
    try {
      const result = await updateGroup(groupId, { status: 'IN_PROGRESS' });
      setGroup(result.group);
      setState((s) => ({ ...s, notice: 'Group started (IN_PROGRESS).' }));
    } catch (error) {
      setState((s) => ({ ...s, error: error.message }));
    }
  };

  const handleCompleteGroup = async () => {
    if (!window.confirm('Complete this group? All matches must be completed first.')) return;
    try {
      const result = await completeGroup(groupId);
      setGroup(result.group);
      setState((s) => ({ ...s, notice: 'Group marked as COMPLETED.' }));
    } catch (error) {
      setState((s) => ({ ...s, error: error.message }));
    }
  };

  // Assign Team
  const handleAssignTeam = async (e) => {
    e.preventDefault();
    if (!selectedTeamId) return;
    setState((s) => ({ ...s, submitting: true, error: '', notice: '' }));
    try {
      const result = await assignTeam(groupId, selectedTeamId);
      setGroup(result.group);
      setSelectedTeamId('');
      setState({ loading: false, submitting: false, notice: 'Team assigned to group.', error: '' });
      loadData();
    } catch (error) {
      setState({ loading: false, submitting: false, error: error.message, notice: '' });
    }
  };

  const handleRemoveTeam = async (teamId) => {
    if (!window.confirm('Remove this team from group?')) return;
    try {
      const result = await removeGroupTeam(groupId, teamId);
      setGroup(result.group);
      setState((s) => ({ ...s, notice: 'Team removed.' }));
      loadData();
    } catch (error) {
      setState((s) => ({ ...s, error: error.message }));
    }
  };

  // Add Match
  const handleAddMatch = async (e) => {
    e.preventDefault();
    setState((s) => ({ ...s, submitting: true, error: '', notice: '' }));
    try {
      const result = await createMatch(groupId, {
        matchNumber: Number(matchForm.matchNumber),
        name: matchForm.name.trim(),
      });
      setMatches((prev) => [...prev, result.match]);
      setMatchForm({ matchNumber: matches.length + 2, name: `Match ${matches.length + 2}` });
      setState({ loading: false, submitting: false, notice: 'Match scheduled.', error: '' });
    } catch (error) {
      setState({ loading: false, submitting: false, error: error.message, notice: '' });
    }
  };

  // Set Match Status
  const handleSetMatchStatus = async (match, status) => {
    try {
      const result = status === 'COMPLETED'
        ? await completeMatch(match.id)
        : await updateMatch(match.id, { status });
      setMatches((prev) => prev.map((m) => (m.id === match.id ? result.match : m)));
      setState((s) => ({ ...s, notice: `Match moved to ${status}.` }));
    } catch (error) {
      setState((s) => ({ ...s, error: error.message }));
    }
  };

  // Submit Score / Result
  const handleScoreSubmit = async (e) => {
    e.preventDefault();
    if (!scoreModal.teamId) return;
    setState((s) => ({ ...s, submitting: true, error: '', notice: '' }));
    try {
      await createResult(scoreModal.matchId, {
        teamId: scoreModal.teamId,
        points: Number(scoreModal.points),
        kills: Number(scoreModal.kills),
        placement: Number(scoreModal.placement),
        resultText: scoreModal.resultText,
      });

      // Recalculate leaderboard
      await recalculateLeaderboard(scoreModal.matchId);
      const res = await fetchGroupLeaderboard(groupId);
      setGroupLeaderboard(res.leaderboard || []);

      setScoreModal({ isOpen: false, matchId: null, matchName: '', teamId: '', points: 0, kills: 0, placement: 1, resultText: '' });
      setState({ loading: false, submitting: false, notice: 'Score recorded and leaderboard updated.', error: '' });

      // Refresh match results
      const updatedScores = await fetchResults(scoreModal.matchId);
      setMatchResults((prev) => ({ ...prev, [scoreModal.matchId]: updatedScores.results || [] }));
    } catch (error) {
      setState({ loading: false, submitting: false, error: error.message, notice: '' });
    }
  };

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
        <p className="status-panel">Loading group workspace...</p>
      </section>
    );
  }

  if (!group) {
    return (
      <section className="workspace-page">
        <Link className="text-link" to={`/organizer/tournaments/${tournamentId}`}>Back to tournament</Link>
        <div className="form-alert" role="alert" style={{ marginTop: '20px' }}>
          {state.error || 'Group not found.'}
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-page organizer-group-workspace">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#91a0b3', marginBottom: '15px' }}>
        <Link className="text-link" to="/organizer/tournaments">Tournaments</Link>
        <span>/</span>
        <Link className="text-link" to={`/organizer/tournaments/${tournamentId}`}>Tournament Control Center</Link>
        <span>/</span>
        <span style={{ color: '#fff', fontWeight: 'bold' }}>{group.name}</span>
      </div>

      {/* Group Header */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(28, 33, 40, 0.95), rgba(13, 17, 23, 0.98))',
        border: '1px solid rgba(125, 211, 252, 0.15)',
        borderRadius: '10px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span className={`status-badge ${group.status.toLowerCase()}`}>
                {group.status}
              </span>
              <span style={{ fontSize: '13px', color: '#7dd3fc' }}>
                Capacity: {group.teams?.length || 0} / {group.groupSize || 12} Teams
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: '28px', color: '#fff' }}>{group.name}</h1>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {group.status === 'NOT_STARTED' && (
              <button className="button primary-button" onClick={handleStartGroup}>
                Start Group (LIVE)
              </button>
            )}
            {group.status === 'IN_PROGRESS' && (
              <button className="button secondary-button" style={{ color: '#f6c453', borderColor: 'rgba(246, 196, 83, 0.4)' }} onClick={handleCompleteGroup}>
                Complete Group
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {state.error && <div className="form-alert" role="alert" style={{ marginBottom: '15px' }}>{state.error}</div>}
      {state.notice && <div className="success-alert" role="status" style={{ marginBottom: '15px' }}>{state.notice}</div>}

      {/* Group Tabs */}
      <nav className="hub-tabs" aria-label="Organizer group tabs" role="tablist" style={{ marginBottom: '20px' }}>
        <button role="tab" aria-selected={activeTab === 'overview'} className={activeTab === 'overview' ? 'hub-tab active' : 'hub-tab'} onClick={() => setTab('overview')}>
          Room & Overview
        </button>
        <button role="tab" aria-selected={activeTab === 'teams'} className={activeTab === 'teams' ? 'hub-tab active' : 'hub-tab'} onClick={() => setTab('teams')}>
          Teams ({group.teams?.length || 0})
        </button>
        <button role="tab" aria-selected={activeTab === 'matches'} className={activeTab === 'matches' ? 'hub-tab active' : 'hub-tab'} onClick={() => setTab('matches')}>
          Matches ({matches.length})
        </button>
        <button role="tab" aria-selected={activeTab === 'leaderboard'} className={activeTab === 'leaderboard' ? 'hub-tab active' : 'hub-tab'} onClick={() => setTab('leaderboard')}>
          Leaderboard
        </button>
        <button role="tab" aria-selected={activeTab === 'chat'} className={activeTab === 'chat' ? 'hub-tab active' : 'hub-tab'} onClick={() => setTab('chat')}>
          Group Chat
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & ROOM CREDENTIALS */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Room Management Form */}
          <form onSubmit={handleSaveRoom} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#7dd3fc' }}>Room & Lobby Management</h3>
            
            <label htmlFor="org-room-id" style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#91a0b3' }}>
              In-Game Custom Room ID
            </label>
            <input
              id="org-room-id"
              style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 10px', marginBottom: '15px' }}
              value={room.roomId}
              onChange={(e) => setRoom({ ...room, roomId: e.target.value })}
              placeholder="e.g. 5839201"
            />

            <label htmlFor="org-room-pass" style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#91a0b3' }}>
              Custom Room Password
            </label>
            <input
              id="org-room-pass"
              style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 10px', marginBottom: '20px' }}
              value={room.roomPassword}
              onChange={(e) => setRoom({ ...room, roomPassword: e.target.value })}
              placeholder="e.g. evo123"
            />

            <button className="button primary-button" type="submit" disabled={state.submitting}>
              Save & Broadcast Room Credentials
            </button>
          </form>

          {/* Quick Group Stats */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#fff' }}>Group Information</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color: '#91a0b3' }}>Group Status:</span>
                <strong style={{ color: '#7dd3fc' }}>{group.status}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color: '#91a0b3' }}>Assigned Teams:</span>
                <strong style={{ color: '#fff' }}>{group.teams?.length || 0} / {group.groupSize || 12}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color: '#91a0b3' }}>Scheduled Matches:</span>
                <strong style={{ color: '#fff' }}>{matches.length}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ color: '#91a0b3' }}>Room Status:</span>
                <strong style={{ color: group.roomId ? '#2ecc71' : '#f6c453' }}>{group.roomId ? 'Configured' : 'Awaiting Room ID'}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TEAMS MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'teams' && (
        <div>
          {/* Assign Team Form */}
          <form onSubmit={handleAssignTeam} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '20px' }}>
            <span style={{ fontWeight: 'bold', color: '#7dd3fc' }}>Assign Verified Team:</span>
            <select
              style={{ flex: '1 1 200px', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              required
            >
              <option value="">Select an eligible verified team...</option>
              {eligibleTeams
                .filter((t) => !group.teams?.some((gt) => gt.id === t.id))
                .map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
            </select>
            <button className="button primary-button" type="submit" disabled={state.submitting || !selectedTeamId}>
              + Assign Team
            </button>
          </form>

          {/* Assigned Teams List */}
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#fff' }}>Assigned Teams ({group.teams?.length || 0})</h3>
            {group.teams?.length === 0 ? (
              <p className="empty-state">No teams assigned to this group yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {group.teams.map((t) => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                    <strong style={{ color: '#fff' }}>{t.name}</strong>
                    <button className="text-button danger-text" onClick={() => handleRemoveTeam(t.id)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MATCHES & SCOREBOARD */}
      {/* ========================================================================= */}
      {activeTab === 'matches' && (
        <div>
          {/* Add Match Form */}
          <form onSubmit={handleAddMatch} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '20px' }}>
            <span style={{ fontWeight: 'bold', color: '#7dd3fc' }}>Schedule Match:</span>
            <input
              type="number"
              min="1"
              style={{ width: '80px', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
              value={matchForm.matchNumber}
              onChange={(e) => setMatchForm({ matchNumber: e.target.value, name: `Match ${e.target.value}` })}
              placeholder="Match #"
              required
            />
            <input
              style={{ flex: '1 1 180px', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 10px' }}
              value={matchForm.name}
              onChange={(e) => setMatchForm({ ...matchForm, name: e.target.value })}
              placeholder="Match Name (e.g. Match 1 - Bermuda)"
              required
            />
            <button className="button primary-button" type="submit" disabled={state.submitting}>
              + Add Match
            </button>
          </form>

          {/* Matches List */}
          {matches.length === 0 ? (
            <p className="empty-state">No matches scheduled in this group yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {matches.map((match) => {
                const isExpanded = expandedResults[match.id];
                const scores = matchResults[match.id] || [];

                return (
                  <div key={match.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ color: '#7dd3fc', fontSize: '13px' }}>Match #{match.matchNumber}</strong>
                          <span className={`status-badge ${match.status.toLowerCase()}`}>{match.status}</span>
                        </div>
                        <h4 style={{ margin: '4px 0 0 0', fontSize: '18px', color: '#fff' }}>{match.name}</h4>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {match.status === 'SCHEDULED' && (
                          <button className="button primary-button" style={{ minHeight: '32px', padding: '0 12px', fontSize: '12px' }} onClick={() => handleSetMatchStatus(match, 'LIVE')}>
                            Start Match (LIVE)
                          </button>
                        )}
                        {match.status === 'LIVE' && (
                          <button className="button secondary-button" style={{ minHeight: '32px', padding: '0 12px', fontSize: '12px' }} onClick={() => handleSetMatchStatus(match, 'COMPLETED')}>
                            Complete Match
                          </button>
                        )}

                        <button
                          className="button ghost-button"
                          style={{ minHeight: '32px', padding: '0 12px', fontSize: '12px' }}
                          onClick={() => setScoreModal({ isOpen: true, matchId: match.id, matchName: match.name, teamId: group.teams?.[0]?.id || '', points: 0, kills: 0, placement: 1, resultText: '' })}
                        >
                          + Record Score
                        </button>

                        <button className="button secondary-button" style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px' }} onClick={() => toggleResult(match.id)}>
                          {isExpanded ? 'Hide Scores ▲' : 'View Scores ▼'}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Scores Table */}
                    {isExpanded && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        {scores.length === 0 ? (
                          <p className="empty-state" style={{ margin: 0, padding: '10px' }}>No scores submitted for this match yet.</p>
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
                              {scores.map((res, i) => (
                                <tr key={res.teamId || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                  <td style={{ padding: '8px', color: '#fff', fontWeight: 'bold' }}>{res.placement || i + 1}</td>
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

          {/* Record Score Modal */}
          {scoreModal.isOpen && (
            <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '20px' }}>
              <form onSubmit={handleScoreSubmit} style={{ background: '#1c2128', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '24px', width: 'min(450px, 100%)' }}>
                <h3 style={{ margin: '0 0 15px 0', color: '#fff' }}>Record Team Score ({scoreModal.matchName})</h3>
                
                <label style={{ display: 'block', fontSize: '13px', color: '#91a0b3', marginBottom: '4px' }}>Team</label>
                <select
                  style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px', marginBottom: '12px' }}
                  value={scoreModal.teamId}
                  onChange={(e) => setScoreModal({ ...scoreModal, teamId: e.target.value })}
                  required
                >
                  <option value="">Select team...</option>
                  {group.teams?.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px' }}>Placement</label>
                    <input
                      type="number"
                      min="1"
                      style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
                      value={scoreModal.placement}
                      onChange={(e) => setScoreModal({ ...scoreModal, placement: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px' }}>Kills</label>
                    <input
                      type="number"
                      min="0"
                      style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
                      value={scoreModal.kills}
                      onChange={(e) => setScoreModal({ ...scoreModal, kills: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px' }}>Points</label>
                    <input
                      type="number"
                      min="0"
                      style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
                      value={scoreModal.points}
                      onChange={(e) => setScoreModal({ ...scoreModal, points: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button className="button ghost-button" type="button" onClick={() => setScoreModal({ ...scoreModal, isOpen: false })}>
                    Cancel
                  </button>
                  <button className="button primary-button" type="submit" disabled={state.submitting}>
                    Save Score
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: GROUP LEADERBOARD */}
      {/* ========================================================================= */}
      {activeTab === 'leaderboard' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>Group Scoreboard & Leaderboard</h3>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
            {groupLeaderboard.length === 0 ? (
              <p className="empty-state">No leaderboard points recorded for this group yet.</p>
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
                  {groupLeaderboard.map((row, index) => (
                    <tr key={`${row.teamId}-${index}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px 15px', fontWeight: 'bold', color: index === 0 ? '#f6c453' : index === 1 ? '#cdd6e2' : index === 2 ? '#d97706' : '#fff' }}>
                        #{row.rank || index + 1}
                      </td>
                      <td style={{ padding: '12px 15px', fontWeight: '500', color: '#fff' }}>{row.teamName}</td>
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

      {/* ========================================================================= */}
      {/* TAB 5: GROUP CHAT */}
      {/* ========================================================================= */}
      {activeTab === 'chat' && (
        <GroupChatView
          groupId={group.id}
          groupName={group.name}
          isCompleted={group.status === 'COMPLETED'}
        />
      )}
    </section>
  );
}
