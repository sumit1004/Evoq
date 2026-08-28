import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams, useOutletContext } from 'react-router-dom';
import { fetchTournament, updateTournament, fetchRegistrations, deleteTournament, fetchTournamentAccess } from '../../services/tournamentApi.js';
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
import { OrganizerRoundsHub } from '../../components/organizer/OrganizerRoundsHub.jsx';
import { LeaderboardTable } from '../../components/common/LeaderboardTable.jsx';
import { PointConfigurationSection } from '../../components/organizer/PointConfigurationSection.jsx';

const ORGANIZER_TABS = ['overview', 'rounds', 'registrations', 'leaderboard', 'announcements', 'settings'];

export function OrganizerTournamentPage() {
  const navigate = useNavigate();
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { joinTournament, leaveTournament, on } = useSocket();
  const outletCtx = useOutletContext() || {};

  const [localAccess, setLocalAccess] = useState(outletCtx.effectiveAccess || null);
  const isScout = outletCtx.isScout ?? (localAccess?.role === 'SCOUT');

  useEffect(() => {
    if (!outletCtx.effectiveAccess && tournamentId) {
      fetchTournamentAccess(tournamentId)
        .then((data) => setLocalAccess(data?.access || null))
        .catch(() => setLocalAccess(null));
    } else if (outletCtx.effectiveAccess) {
      setLocalAccess(outletCtx.effectiveAccess);
    }
  }, [tournamentId, outletCtx.effectiveAccess]);

  const effectiveAccess = outletCtx.effectiveAccess || localAccess;
  const permissions = new Set(effectiveAccess?.permissions || []);

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Forms
  const [newRound, setNewRound] = useState({ roundNumber: 1, name: 'Round 1' });
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
            } catch {
              groupMap[r.id] = [];
            }
          })
        );
        setRoundGroups(groupMap);
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

  const handleDeleteTournament = async () => {
    setState((s) => ({ ...s, submitting: true, error: '', notice: '' }));
    try {
      await deleteTournament(tournamentId);
      navigate('/organizer/tournaments');
    } catch (error) {
      setState((s) => ({ ...s, submitting: false, error: error.message }));
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
            {isScout && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                padding: '6px 14px',
                borderRadius: '20px',
                marginBottom: '12px',
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8', display: 'inline-block' }} />
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.05em' }}>
                  SCOUT MODE · RESTRICTED ACCESS ({permissions.size} CAPABILITIES GRANTED)
                </span>
              </div>
            )}

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
            {!isScout && tournament.status === 'DRAFT' && (
              <button className="button primary-button" onClick={() => handleTransition('REGISTRATION_OPEN')}>
                Open Registration
              </button>
            )}
            {!isScout && tournament.status === 'REGISTRATION_OPEN' && (
              <button className="button secondary-button" onClick={() => handleTransition('REGISTRATION_CLOSED')}>
                Close Registration
              </button>
            )}
            {(!isScout || permissions.has('START_TOURNAMENT')) && tournament.status === 'REGISTRATION_CLOSED' && (
              <button className="button primary-button" onClick={() => handleTransition('LIVE')}>
                Start Tournament (LIVE)
              </button>
            )}
            {(!isScout || permissions.has('COMPLETE_TOURNAMENT')) && tournament.status === 'LIVE' && (
              <button className="button secondary-button" style={{ color: '#f6c453', borderColor: 'rgba(246, 196, 83, 0.4)' }} onClick={handleCompleteTournament}>
                Finalize Tournament
              </button>
            )}
            {(!isScout || permissions.has('VIEW_REGISTRATIONS')) && (
              <Link className="button ghost-button" to={`/organizer/tournaments/${tournamentId}/registrations`}>
                Registrations ({registrations.length})
              </Link>
            )}
            {!isScout && (
              <button
                className="button ghost-button danger-text"
                style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}
                type="button"
                onClick={() => setShowDeleteModal(true)}
              >
                Delete Tournament
              </button>
            )}
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
          Registrations ({registrations.length}) {isScout && !permissions.has('VIEW_REGISTRATIONS') && '🔒'}
        </button>
        <button role="tab" aria-selected={activeTab === 'leaderboard'} className={activeTab === 'leaderboard' ? 'hub-tab active' : 'hub-tab'} onClick={() => setTab('leaderboard')}>
          Leaderboard {isScout && !permissions.has('VIEW_LEADERBOARD') && '🔒'}
        </button>
        <button role="tab" aria-selected={activeTab === 'announcements'} className={activeTab === 'announcements' ? 'hub-tab active' : 'hub-tab'} onClick={() => setTab('announcements')}>
          Communications ({announcements.length}) {isScout && !permissions.has('VIEW_ANNOUNCEMENTS') && '🔒'}
        </button>
        <button role="tab" aria-selected={activeTab === 'settings'} className={activeTab === 'settings' ? 'hub-tab active' : 'hub-tab'} onClick={() => setTab('settings')}>
          Settings {isScout && !permissions.has('MANAGE_SETTINGS') && '🔒'}
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
                      <button
                        className="button secondary-button"
                        style={{ minHeight: '30px', padding: '0 10px', fontSize: '12px' }}
                        onClick={() => {
                          const next = new URLSearchParams(searchParams);
                          next.set('tab', 'rounds');
                          next.set('round', round.id);
                          next.set('section', 'overview');
                          setSearchParams(next);
                        }}
                      >
                        Manage Round →
                      </button>
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
      {/* TAB 2: ROUNDS & GROUPS (CANONICAL SINGLE-PAGE CONTROL CENTER) */}
      {/* ========================================================================= */}
      {activeTab === 'rounds' && (
        <OrganizerRoundsHub
          tournamentId={tournamentId}
          tournamentStatus={tournament?.status}
          effectiveAccess={effectiveAccess}
          isScout={isScout}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 3: REGISTRATIONS */}
      {/* ========================================================================= */}
      {activeTab === 'registrations' && (
        isScout && !permissions.has('VIEW_REGISTRATIONS') ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔒</div>
            <h3 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px' }}>Registration Access Restricted</h3>
            <p style={{ color: '#91a0b3', maxWidth: '480px', margin: '0 auto 16px' }}>
              You do not have permission to view or verify player registrations for this tournament. Please contact the tournament organizer to request registration access.
            </p>
            <span style={{ fontSize: '11px', color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(56,189,248,0.2)' }}>
              REQUIRES: VIEW_REGISTRATIONS
            </span>
          </div>
        ) : (
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
        )
      )}

      {/* ========================================================================= */}
      {/* TAB 4: LEADERBOARD */}
      {/* ========================================================================= */}
      {activeTab === 'leaderboard' && (
        isScout && !permissions.has('VIEW_LEADERBOARD') ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔒</div>
            <h3 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px' }}>Leaderboard Access Restricted</h3>
            <p style={{ color: '#91a0b3', maxWidth: '480px', margin: '0 auto 16px' }}>
              You do not have permission to view tournament leaderboard standings.
            </p>
            <span style={{ fontSize: '11px', color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(56,189,248,0.2)' }}>
              REQUIRES: VIEW_LEADERBOARD
            </span>
          </div>
        ) : (
          <LeaderboardTable
            rows={leaderboard}
            title="Overall Tournament Standings"
            subtitle="Calculated across all completed rounds and match points"
            emptyMessage="No leaderboard data calculated yet."
          />
        )
      )}

      {/* ========================================================================= */}
      {/* TAB 5: COMMUNICATIONS & ANNOUNCEMENTS */}
      {/* ========================================================================= */}
      {activeTab === 'announcements' && (
        isScout && !permissions.has('VIEW_ANNOUNCEMENTS') ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔒</div>
            <h3 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px' }}>Communications Restricted</h3>
            <p style={{ color: '#91a0b3', maxWidth: '480px', margin: '0 auto 16px' }}>
              You do not have permission to view official tournament broadcasts.
            </p>
            <span style={{ fontSize: '11px', color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(56,189,248,0.2)' }}>
              REQUIRES: VIEW_ANNOUNCEMENTS
            </span>
          </div>
        ) : (
          <div>
            {(!isScout || permissions.has('CREATE_ANNOUNCEMENTS')) && (
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
            )}

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
                    {!isScout && (
                      <button className="text-button danger-text" onClick={() => handleDeleteAnnouncement(a.id)}>
                        Delete
                      </button>
                    )}
                  </article>
                ))
              )}
            </div>
          </div>
        )
      )}

      {/* ========================================================================= */}
      {/* TAB 6: SETTINGS & ARCHIVE */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        isScout && !permissions.has('MANAGE_SETTINGS') ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔒</div>
            <h3 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px' }}>Tournament Settings Restricted</h3>
            <p style={{ color: '#91a0b3', maxWidth: '480px', margin: '0 auto 16px' }}>
              Point configurations and tournament parameters can only be modified by authorized staff.
            </p>
            <span style={{ fontSize: '11px', color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(56,189,248,0.2)' }}>
              REQUIRES: MANAGE_SETTINGS
            </span>
          </div>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#fff' }}>Tournament Configuration</h3>
            <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
              <div className="detail-panel"><strong>Game</strong><span>{tournament.game || 'Free Fire'}</span></div>
              <div className="detail-panel"><strong>Max Teams</strong><span>{tournament.maxTeams}</span></div>
              <div className="detail-panel"><strong>Players per Team</strong><span>{tournament.playersPerTeam}</span></div>
              <div className="detail-panel"><strong>Entry Type</strong><span>{tournament.entryType}</span></div>
              <div className="detail-panel"><strong>Entry Fee</strong><span>₹{tournament.entryFee || 0}</span></div>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <PointConfigurationSection
                tournamentId={tournamentId}
                isCompleted={tournament.status === 'COMPLETED'}
              />
            </div>

            {(!isScout || permissions.has('COMPLETE_TOURNAMENT')) && (
              <div style={{ paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)', marginBottom: '25px' }}>
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
            )}

            {!isScout && (
              <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '20px' }}>
                <h4 style={{ color: '#ef4444', margin: '0 0 8px 0', fontSize: '16px' }}>Delete Tournament</h4>
                <p style={{ color: '#cdd6e2', fontSize: '13px', margin: '0 0 15px 0', lineHeight: 1.5 }}>
                  Permanently delete this tournament, along with its rounds, groups, matches, announcements, and registrations. This action cannot be undone.
                </p>
                <button
                  className="button danger-button"
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                >
                  Delete This Tournament
                </button>
              </div>
            )}
          </div>
        )
      )}

      {/* Delete Tournament Modal */}
      {showDeleteModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300,
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDeleteModal(false);
          }}
        >
          <div
            style={{
              background: '#1c2128',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '12px',
              padding: '28px',
              width: 'min(480px, 100%)',
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '24px' }}>⚠️</span>
              <h3 style={{ margin: 0, color: '#ef4444', fontSize: '20px' }}>Delete Tournament</h3>
            </div>

            <p style={{ color: '#cdd6e2', fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>
              Are you sure you want to permanently delete <strong>"{tournament.name}"</strong>?
            </p>

            <div
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '8px',
                padding: '14px',
                fontSize: '13px',
                color: '#fca5a5',
                lineHeight: 1.5,
                marginBottom: '20px',
              }}
            >
              <strong>Warning:</strong> This will permanently delete all {rounds.length} rounds, groups, scheduled matches, and {registrations.length} team registrations. This action cannot be reversed.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="button ghost-button"
                type="button"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                className="button danger-button"
                type="button"
                onClick={handleDeleteTournament}
                disabled={state.submitting}
                style={{ minWidth: '140px' }}
              >
                {state.submitting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
