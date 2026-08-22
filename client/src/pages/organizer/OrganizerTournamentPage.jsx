import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { fetchTournament, updateTournament, fetchRegistrations } from '../../services/tournamentApi.js';
import {
  fetchRounds,
  createRound,
  updateRound,
  fetchGroups,
  createGroup,
  fetchTournamentLeaderboard
} from '../../services/competitionApi.js';
import {
  fetchAnnouncements,
  createAnnouncement,
  deleteAnnouncement
} from '../../services/communicationApi.js';
import { completeTournament } from '../../services/archiveApi.js';
import { useSocket } from '../../context/SocketContext.jsx';

const ORGANIZER_TABS = ['overview', 'rounds', 'registrations', 'leaderboard', 'announcements', 'settings'];

export function OrganizerTournamentPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { joinTournament, leaveTournament, on, connected } = useSocket();

  const activeTab = ORGANIZER_TABS.includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'overview';

  const setTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  };

  // State
  const [tournament, setTournament] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [roundGroups, setRoundGroups] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  // Forms
  const [newRound, setNewRound] = useState({ roundNumber: 1, name: 'Round 1' });
  const [newGroup, setNewGroup] = useState({ roundId: '', name: 'Group A', groupSize: 12 });
  const [announcementText, setAnnouncementText] = useState('');
  const [state, setState] = useState({ loading: true, submitting: false, error: '', notice: '' });

  // Load All Tournament Management Data
  const loadAll = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '', notice: '' }));
    try {
      const [tourneyRes, regRes, roundsRes, leaderRes, announceRes] = await Promise.allSettled([
        fetchTournament(tournamentId),
        fetchRegistrations(tournamentId),
        fetchRounds(tournamentId),
        fetchTournamentLeaderboard(tournamentId),
        fetchAnnouncements(tournamentId),
      ]);

      if (tourneyRes.status === 'fulfilled') {
        setTournament(tourneyRes.value.tournament);
      } else {
        throw new Error('Tournament not found or unauthorized.');
      }

      if (regRes.status === 'fulfilled') {
        setRegistrations(regRes.value.registrations || []);
      }

      if (roundsRes.status === 'fulfilled') {
        const roundList = roundsRes.value.rounds || [];
        setRounds(roundList);
        setNewRound({ roundNumber: roundList.length + 1, name: `Round ${roundList.length + 1}` });

        // Load groups for each round
        const groupMap = {};
        await Promise.all(
          roundList.map(async (r) => {
            try {
              const res = await fetchGroups(r.id);
              groupMap[r.id] = res.groups || [];
            } catch (e) {
              groupMap[r.id] = [];
            }
          })
        );
        setRoundGroups(groupMap);
        if (roundList.length > 0) {
          setNewGroup((g) => ({ ...g, roundId: g.roundId || roundList[0].id }));
        }
      }

      if (leaderRes.status === 'fulfilled') {
        setLeaderboard(leaderRes.value.leaderboard || []);
      }
      if (announceRes.status === 'fulfilled') {
        setAnnouncements(announceRes.value.announcements || []);
      }

      setState({ loading: false, submitting: false, error: '', notice: '' });
    } catch (error) {
      setState({ loading: false, submitting: false, error: error.message, notice: '' });
    }
  }, [tournamentId]);

  useEffect(() => {
    joinTournament(tournamentId);
    loadAll();

    const removeRegCreated = on('registration_created', loadAll);
    const removeRegUpdated = on('registration_updated', loadAll);
    const removeAnnounce = on('announcement', (item) => {
      setAnnouncements((prev) => [item, ...prev.filter((a) => a.id !== item.id)]);
    });

    return () => {
      leaveTournament(tournamentId);
      removeRegCreated();
      removeRegUpdated();
      removeAnnounce();
    };
  }, [tournamentId, joinTournament, leaveTournament, loadAll, on]);

  // Lifecycle Transitions
  const handleTransition = async (status) => {
    setState((s) => ({ ...s, submitting: true, error: '', notice: '' }));
    try {
      const result = await updateTournament(tournamentId, { status });
      setTournament(result.tournament);
      setState({ loading: false, submitting: false, notice: `Tournament lifecycle updated to ${status}.`, error: '' });
    } catch (error) {
      setState({ loading: false, submitting: false, error: error.message, notice: '' });
    }
  };

  const handleCompleteTournament = async () => {
    if (!window.confirm('Are you sure you want to finalize and archive this tournament? All actions will become read-only.')) return;
    setState((s) => ({ ...s, submitting: true, error: '', notice: '' }));
    try {
      await completeTournament(tournamentId);
      setState({ loading: false, submitting: false, notice: 'Tournament completed and archived.', error: '' });
      loadAll();
    } catch (error) {
      setState({ loading: false, submitting: false, error: error.message, notice: '' });
    }
  };

  // Create Round
  const handleCreateRound = async (e) => {
    e.preventDefault();
    setState((s) => ({ ...s, submitting: true, error: '', notice: '' }));
    try {
      const result = await createRound(tournamentId, {
        roundNumber: Number(newRound.roundNumber),
        name: newRound.name.trim()
      });
      setRounds((prev) => [...prev, result.round]);
      setNewRound({ roundNumber: rounds.length + 2, name: `Round ${rounds.length + 2}` });
      setState({ loading: false, submitting: false, notice: `Round "${result.round.name}" created.`, error: '' });
    } catch (error) {
      setState({ loading: false, submitting: false, error: error.message, notice: '' });
    }
  };

  // Start Round
  const handleStartRound = async (roundId) => {
    try {
      const result = await updateRound(roundId, { status: 'IN_PROGRESS' });
      setRounds((prev) => prev.map((r) => (r.id === roundId ? result.round : r)));
      setState((s) => ({ ...s, notice: 'Round started.' }));
    } catch (error) {
      setState((s) => ({ ...s, error: error.message }));
    }
  };

  // Create Group
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroup.roundId) return;
    setState((s) => ({ ...s, submitting: true, error: '', notice: '' }));
    try {
      const result = await createGroup(newGroup.roundId, {
        name: newGroup.name.trim(),
        groupSize: Number(newGroup.groupSize) || 12
      });
      setRoundGroups((prev) => ({
        ...prev,
        [newGroup.roundId]: [...(prev[newGroup.roundId] || []), result.group]
      }));
      setNewGroup((g) => ({ ...g, name: `Group ${String.fromCharCode(65 + (roundGroups[newGroup.roundId]?.length || 0) + 1)}` }));
      setState({ loading: false, submitting: false, notice: `Group "${result.group.name}" created.`, error: '' });
    } catch (error) {
      setState({ loading: false, submitting: false, error: error.message, notice: '' });
    }
  };

  // Create Announcement
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementText.trim()) return;
    setState((s) => ({ ...s, submitting: true, error: '', notice: '' }));
    try {
      const result = await createAnnouncement(tournamentId, announcementText.trim());
      setAnnouncements((prev) => [result.announcement, ...prev]);
      setAnnouncementText('');
      setState({ loading: false, submitting: false, notice: 'Announcement broadcasted to participants.', error: '' });
    } catch (error) {
      setState({ loading: false, submitting: false, error: error.message, notice: '' });
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await deleteAnnouncement(id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      setState((s) => ({ ...s, notice: 'Announcement removed.' }));
    } catch (error) {
      setState((s) => ({ ...s, error: error.message }));
    }
  };

  // Stats calculation
  const verifiedCount = registrations.filter((r) => r.status === 'VERIFIED').length;
  const pendingCount = registrations.filter((r) => r.status === 'PENDING').length;
  const activeRound = rounds.find((r) => r.status === 'IN_PROGRESS') || rounds[0];

  const totalGroups = Object.values(roundGroups).flat().length;
  const totalMatches = Object.values(roundGroups)
    .flat()
    .reduce((acc, g) => acc + (g.matches?.length || 0), 0);
  const liveMatches = Object.values(roundGroups)
    .flat()
    .reduce((acc, g) => acc + (g.matches?.filter((m) => m.status === 'LIVE').length || 0), 0);
  const completedMatches = Object.values(roundGroups)
    .flat()
    .reduce((acc, g) => acc + (g.matches?.filter((m) => m.status === 'COMPLETED').length || 0), 0);

  if (state.loading) {
    return (
      <section className="workspace-page">
        <p className="status-panel">Loading tournament command center...</p>
      </section>
    );
  }

  if (!tournament) {
    return (
      <section className="workspace-page">
        <Link className="text-link" to="/organizer/tournaments">Back to tournaments</Link>
        <div className="form-alert" role="alert" style={{ marginTop: '20px' }}>
          {state.error || 'Tournament not found.'}
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-page organizer-control-center">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#91a0b3', marginBottom: '15px' }}>
        <Link className="text-link" to="/organizer">Organizer</Link>
        <span>/</span>
        <Link className="text-link" to="/organizer/tournaments">Tournaments</Link>
        <span>/</span>
        <span style={{ color: '#fff', fontWeight: 'bold' }}>{tournament.name}</span>
      </div>

      {/* Hero Control Card */}
      <div style={{
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
              {activeRound && (
                <span style={{ fontSize: '13px', color: '#f6c453', background: 'rgba(246, 196, 83, 0.1)', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                  {activeRound.name} · {activeRound.status}
                </span>
              )}
            </div>

            <h1 style={{ margin: '0 0 8px 0', fontSize: 'clamp(1.8rem, 2.5rem, 3rem)', color: '#fff' }}>
              {tournament.name}
            </h1>
            <p style={{ margin: 0, color: '#91a0b3', fontSize: '14px', maxWidth: '700px' }}>
              {tournament.description || 'Tournament Control Center for operational management, verification, rounds, and match tracking.'}
            </p>
          </div>

          {/* Quick Lifecycle Action Controls */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {tournament.status === 'DRAFT' && (
              <button className="button primary-button" onClick={() => handleTransition('REGISTRATION_OPEN')}>
                Open Registration
              </button>
            )}
            {tournament.status === 'REGISTRATION_OPEN' && (
              <button className="button secondary-button" onClick={() => handleTransition('REGISTRATION_CLOSED')}>
                Close Registration
              </button>
            )}
            {tournament.status === 'REGISTRATION_CLOSED' && (
              <button className="button primary-button" onClick={() => handleTransition('LIVE')}>
                Start Tournament (LIVE)
              </button>
            )}
            {tournament.status === 'LIVE' && (
              <button className="button secondary-button" style={{ color: '#f6c453', borderColor: 'rgba(246, 196, 83, 0.4)' }} onClick={handleCompleteTournament}>
                Finalize Tournament
              </button>
            )}
            <Link className="button ghost-button" to={`/organizer/tournaments/${tournamentId}/registrations`}>
              Registrations ({registrations.length})
            </Link>
          </div>
        </div>
      </div>

      {/* Notifications and Alerts */}
      {state.error && <div className="form-alert" role="alert" style={{ marginBottom: '15px' }}>{state.error}</div>}
      {state.notice && <div className="success-alert" role="status" style={{ marginBottom: '15px' }}>{state.notice}</div>}

      {/* Primary Control Center Tabs */}
      <nav className="hub-tabs" aria-label="Organizer tournament tabs" role="tablist" style={{ marginBottom: '20px' }}>
        <button role="tab" aria-selected={activeTab === 'overview'} className={activeTab === 'overview' ? 'hub-tab active' : 'hub-tab'} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button role="tab" aria-selected={activeTab === 'rounds'} className={activeTab === 'rounds' ? 'hub-tab active' : 'hub-tab'} onClick={() => setTab('rounds')}>
          Rounds & Groups ({rounds.length})
        </button>
        <button role="tab" aria-selected={activeTab === 'registrations'} className={activeTab === 'registrations' ? 'hub-tab active' : 'hub-tab'} onClick={() => setTab('registrations')}>
          Registrations ({registrations.length})
        </button>
        <button role="tab" aria-selected={activeTab === 'leaderboard'} className={activeTab === 'leaderboard' ? 'hub-tab active' : 'hub-tab'} onClick={() => setTab('leaderboard')}>
          Leaderboard
        </button>
        <button role="tab" aria-selected={activeTab === 'announcements'} className={activeTab === 'announcements' ? 'hub-tab active' : 'hub-tab'} onClick={() => setTab('announcements')}>
          Communications ({announcements.length})
        </button>
        <button role="tab" aria-selected={activeTab === 'settings'} className={activeTab === 'settings' ? 'hub-tab active' : 'hub-tab'} onClick={() => setTab('settings')}>
          Settings
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div>
          {/* Operational Metrics Cards */}
          <div className="header-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div className="stat-tile" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px' }}>
              <span style={{ fontSize: '12px', color: '#91a0b3', textTransform: 'uppercase', fontWeight: 'bold' }}>Teams Verified</span>
              <strong style={{ fontSize: '24px', color: '#2ecc71', display: 'block', marginTop: '4px' }}>
                {verifiedCount} / {tournament.maxTeams}
              </strong>
            </div>

            <div className="stat-tile" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px' }}>
              <span style={{ fontSize: '12px', color: '#91a0b3', textTransform: 'uppercase', fontWeight: 'bold' }}>Pending Applications</span>
              <strong style={{ fontSize: '24px', color: pendingCount > 0 ? '#f6c453' : '#fff', display: 'block', marginTop: '4px' }}>
                {pendingCount}
              </strong>
            </div>

            <div className="stat-tile" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px' }}>
              <span style={{ fontSize: '12px', color: '#91a0b3', textTransform: 'uppercase', fontWeight: 'bold' }}>Competition Groups</span>
              <strong style={{ fontSize: '24px', color: '#7dd3fc', display: 'block', marginTop: '4px' }}>
                {totalGroups}
              </strong>
            </div>

            <div className="stat-tile" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px' }}>
              <span style={{ fontSize: '12px', color: '#91a0b3', textTransform: 'uppercase', fontWeight: 'bold' }}>Matches Progress</span>
              <strong style={{ fontSize: '24px', color: '#fff', display: 'block', marginTop: '4px' }}>
                {completedMatches} / {totalMatches} {liveMatches > 0 && <span style={{ fontSize: '14px', color: '#2ecc71' }}>({liveMatches} LIVE)</span>}
              </strong>
            </div>
          </div>

          {/* Operational Action Banner / Quick Alerts */}
          {pendingCount > 0 && (
            <div style={{
              background: 'rgba(246, 196, 83, 0.1)',
              border: '1px solid rgba(246, 196, 83, 0.3)',
              borderRadius: '8px',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <div>
                <strong style={{ color: '#f6c453' }}>Action Required:</strong> {pendingCount} team {pendingCount === 1 ? 'application requires' : 'applications require'} payment proof review and verification.
              </div>
              <Link className="button primary-button" to={`/organizer/tournaments/${tournamentId}/registrations`} style={{ minHeight: '34px', padding: '0 14px', fontSize: '13px' }}>
                Review Now →
              </Link>
            </div>
          )}

          {/* Quick Overview Summary Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {/* Rounds & Progression Box */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>Tournament Progression</h3>
                <button className="text-button" style={{ color: '#7dd3fc' }} onClick={() => setTab('rounds')}>Manage Rounds</button>
              </div>
              {rounds.length === 0 ? (
                <p className="empty-state">No rounds created yet. Set up Round 1 to start assigning groups.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {rounds.map((round) => (
                    <div key={round.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                      <div>
                        <strong style={{ color: '#fff' }}>{round.name}</strong>
                        <span style={{ fontSize: '12px', color: '#91a0b3', display: 'block' }}>
                          {roundGroups[round.id]?.length || 0} Groups · Status: {round.status}
                        </span>
                      </div>
                      <Link className="button secondary-button" style={{ minHeight: '30px', padding: '0 10px', fontSize: '12px' }} to={`/organizer/tournaments/${tournamentId}/rounds/${round.id}/groups`}>
                        Groups
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Announcements */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>Broadcasts & Announcements</h3>
                <button className="text-button" style={{ color: '#7dd3fc' }} onClick={() => setTab('announcements')}>New Broadcast</button>
              </div>
              {announcements.length === 0 ? (
                <p className="empty-state">No announcements published.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {announcements.slice(0, 3).map((a) => (
                    <div key={a.id} style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#fff' }}>{a.message}</p>
                      <span style={{ fontSize: '11px', color: '#91a0b3' }}>{new Date(a.createdAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ROUNDS & GROUPS (PROGRESSION VIEW) */}
      {/* ========================================================================= */}
      {activeTab === 'rounds' && (
        <div>
          {/* Create Round Bar */}
          <form onSubmit={handleCreateRound} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '25px' }}>
            <span style={{ fontWeight: 'bold', color: '#7dd3fc' }}>Add Competition Round:</span>
            <input
              type="number"
              min="1"
              style={{ width: '80px', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px' }}
              value={newRound.roundNumber}
              onChange={(e) => setNewRound({ roundNumber: e.target.value, name: `Round ${e.target.value}` })}
              placeholder="Round #"
              required
            />
            <input
              style={{ flex: '1 1 200px', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 10px' }}
              value={newRound.name}
              onChange={(e) => setNewRound({ ...newRound, name: e.target.value })}
              placeholder="Round Name (e.g. Round 1, Semi-Final, Final)"
              required
            />
            <button className="button primary-button" type="submit" disabled={state.submitting}>
              + Create Round
            </button>
          </form>

          {/* Progression Tree / Visual Progression */}
          {rounds.length === 0 ? (
            <p className="empty-state">No rounds configured yet. Create Round 1 to start competition setup.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
              {rounds.map((round) => {
                const groups = roundGroups[round.id] || [];

                return (
                  <div
                    key={round.id}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: round.status === 'IN_PROGRESS' ? '1px solid rgba(125,211,252,0.3)' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      padding: '20px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '15px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>{round.name}</h3>
                          <span className={`status-badge ${round.status.toLowerCase().replaceAll('_', '-')}`}>
                            {round.status.replaceAll('_', ' ')}
                          </span>
                        </div>
                        <span style={{ fontSize: '13px', color: '#91a0b3' }}>
                          Round #{round.roundNumber} · {groups.length} Groups Configured
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        {round.status === 'NOT_STARTED' && (
                          <button className="button secondary-button" onClick={() => handleStartRound(round.id)}>
                            Start Round
                          </button>
                        )}
                        <Link className="button ghost-button" to={`/organizer/tournaments/${tournamentId}/rounds/${round.id}/qualifications`}>
                          Qualifications
                        </Link>
                      </div>
                    </div>

                    {/* Groups Grid inside this Round */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                      {groups.map((group) => (
                        <div
                          key={group.id}
                          style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '6px',
                            padding: '14px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <strong style={{ color: '#fff', fontSize: '16px' }}>{group.name}</strong>
                              <span className={`status-badge ${group.status.toLowerCase()}`} style={{ fontSize: '10px' }}>
                                {group.status}
                              </span>
                            </div>
                            <span style={{ fontSize: '12px', color: '#91a0b3', display: 'block' }}>
                              {group.teams?.length || 0} Teams · Room: {group.roomId ? 'Ready' : 'Not set'}
                            </span>
                            <span style={{ fontSize: '12px', color: '#7dd3fc', display: 'block', marginTop: '2px' }}>
                              {group.matches?.length || 0} Matches
                            </span>
                          </div>

                          <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <Link className="button primary-button" style={{ minHeight: '30px', padding: '0 10px', fontSize: '12px' }} to={`/organizer/tournaments/${tournamentId}/groups/${group.id}`}>
                              Open Workspace →
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add Group inline Form for this round */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        createGroup(round.id, { name: `Group ${String.fromCharCode(65 + groups.length)}`, groupSize: 12 }).then((res) => {
                          setRoundGroups((prev) => ({ ...prev, [round.id]: [...(prev[round.id] || []), res.group] }));
                        });
                      }}
                      style={{ marginTop: '15px', display: 'flex', justifyContent: 'flex-end' }}
                    >
                      <button className="button ghost-button" style={{ minHeight: '32px', padding: '0 12px', fontSize: '12px' }} type="submit">
                        + Add Group {String.fromCharCode(65 + groups.length)} to {round.name}
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: REGISTRATIONS */}
      {/* ========================================================================= */}
      {activeTab === 'registrations' && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '24px', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', color: '#fff' }}>Registration & Payment Management</h3>
          <p style={{ color: '#91a0b3', maxWidth: '600px', margin: '0 auto 20px auto' }}>
            Verify player teams, review submitted transaction IDs & payment screenshots with lightbox zoom, and export Excel / CSV spreadsheets with full member snapshots.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
            <Link className="button primary-button" to={`/organizer/tournaments/${tournamentId}/registrations`}>
              Open Registration Console ({registrations.length} Applications) →
            </Link>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: LEADERBOARD */}
      {/* ========================================================================= */}
      {activeTab === 'leaderboard' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>Overall Tournament Standings</h3>
            <span style={{ fontSize: '13px', color: '#91a0b3' }}>
              Calculated across all completed rounds and match points
            </span>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
            {leaderboard.length === 0 ? (
              <p className="empty-state">No leaderboard data calculated yet.</p>
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
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: COMMUNICATIONS & ANNOUNCEMENTS */}
      {/* ========================================================================= */}
      {activeTab === 'announcements' && (
        <div>
          <form onSubmit={handleCreateAnnouncement} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '20px', marginBottom: '25px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#fff' }}>Broadcast Tournament Announcement</h3>
            <textarea
              style={{ width: '100%', minHeight: '80px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#fff', padding: '10px', marginBottom: '10px' }}
              placeholder="Write an announcement message to broadcast to all tournament participants..."
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              required
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="button primary-button" type="submit" disabled={state.submitting || !announcementText.trim()}>
                Broadcast Announcement
              </button>
            </div>
          </form>

          <div className="registration-list">
            <h3 style={{ fontSize: '16px', color: '#fff', marginBottom: '10px' }}>Announcement History</h3>
            {announcements.length === 0 ? (
              <p className="empty-state">No announcements published yet.</p>
            ) : (
              announcements.map((a) => (
                <article className="registration-item" key={a.id}>
                  <div>
                    <strong style={{ color: '#7dd3fc' }}>{a.creatorName}</strong>
                    <p style={{ margin: '4px 0 0 0', color: '#fff' }}>{a.message}</p>
                    <time style={{ fontSize: '12px', color: '#91a0b3' }}>{new Date(a.createdAt).toLocaleString()}</time>
                  </div>
                  <button className="text-button danger-text" onClick={() => handleDeleteAnnouncement(a.id)}>
                    Delete
                  </button>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: SETTINGS & ARCHIVE */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#fff' }}>Tournament Configuration</h3>
          <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
            <div className="detail-panel"><strong>Game</strong><span>{tournament.game || 'Free Fire'}</span></div>
            <div className="detail-panel"><strong>Max Teams</strong><span>{tournament.maxTeams}</span></div>
            <div className="detail-panel"><strong>Players per Team</strong><span>{tournament.playersPerTeam}</span></div>
            <div className="detail-panel"><strong>Entry Type</strong><span>{tournament.entryType}</span></div>
            <div className="detail-panel"><strong>Entry Fee</strong><span>₹{tournament.entryFee || 0}</span></div>
          </div>

          <div style={{ paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <h4 style={{ color: '#ff6b6b', margin: '0 0 8px 0' }}>Finalize and Archive Tournament</h4>
            <p style={{ color: '#91a0b3', fontSize: '13px', margin: '0 0 15px 0' }}>
              Finalizing marks the tournament as COMPLETED and preserves all historical leaderboards, match stats, and certificates while making live controls read-only.
            </p>
            <button
              className="button secondary-button"
              style={{ color: '#ff6b6b', borderColor: 'rgba(231,76,60,0.3)' }}
              onClick={handleCompleteTournament}
              disabled={tournament.status === 'COMPLETED'}
            >
              {tournament.status === 'COMPLETED' ? 'Tournament is Archived' : 'Complete & Archive Tournament'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
