import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  completeMatch,
  createResult,
  deleteMatch,
  fetchGroup,
  fetchMatch,
  fetchMatchLeaderboard,
  fetchResults,
  notifyMatchSchedule,
  recalculateLeaderboard,
  updateMatch
} from '../../services/competitionApi.js';

export function OrganizerMatchResultsPage() {
  const { tournamentId, roundId, groupId, matchId } = useParams();
  const navigate = useNavigate();

  const [match, setMatch] = useState(null);
  const [group, setGroup] = useState(null);
  const [teams, setTeams] = useState([]);
  const [results, setResults] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  // Match Configuration Forms
  const [roomForm, setRoomForm] = useState({ roomId: '', roomPassword: '', instructions: '' });
  const [scheduleForm, setScheduleForm] = useState({ scheduledAt: '', checkInAt: '', lobbyOpenAt: '' });

  // Score Entry Form
  const [scoreForm, setScoreForm] = useState({
    teamId: '',
    points: 0,
    kills: 0,
    placement: '',
    resultText: '',
    resultMedia: null
  });
  const [fileKey, setFileKey] = useState(Date.now());
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [state, setState] = useState({ loading: true, submitting: false, error: '', notice: '' });

  const loadData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '', notice: '' }));
    try {
      const matchResult = await fetchMatch(matchId);
      const currentMatch = matchResult.match;
      setMatch(currentMatch);

      setRoomForm({
        roomId: currentMatch.roomId || '',
        roomPassword: currentMatch.roomPassword || '',
        instructions: currentMatch.instructions || '',
      });

      setScheduleForm({
        scheduledAt: currentMatch.scheduledAt ? currentMatch.scheduledAt.slice(0, 16) : '',
        checkInAt: currentMatch.checkInAt ? currentMatch.checkInAt.slice(0, 16) : '',
        lobbyOpenAt: currentMatch.lobbyOpenAt ? currentMatch.lobbyOpenAt.slice(0, 16) : '',
      });

      const currentGroupId = currentMatch.groupId || groupId;
      const [groupResult, resultResult, leaderboardResult] = await Promise.all([
        fetchGroup(currentGroupId),
        fetchResults(matchId),
        fetchMatchLeaderboard(matchId)
      ]);

      setGroup(groupResult.group);
      setTeams(groupResult.group?.teams || []);
      setResults(resultResult.results || []);
      setLeaderboard(leaderboardResult.leaderboard || []);
      setState({ loading: false, submitting: false, error: '', notice: '' });
    } catch (error) {
      setState({ loading: false, submitting: false, error: error.message || 'Failed to load match workspace.', notice: '' });
    }
  }, [matchId, groupId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update Status
  const handleSetStatus = async (newStatus) => {
    setState((s) => ({ ...s, submitting: true, error: '', notice: '' }));
    try {
      const result = newStatus === 'COMPLETED'
        ? await completeMatch(matchId)
        : await updateMatch(matchId, { status: newStatus });
      setMatch(result.match);
      setState({ loading: false, submitting: false, notice: `Match moved to ${newStatus}.`, error: '' });
    } catch (error) {
      setState((s) => ({ ...s, submitting: false, error: error.message }));
    }
  };

  // Save Room Credentials
  const handleSaveRoom = async (e) => {
    e.preventDefault();
    setState((s) => ({ ...s, submitting: true, error: '', notice: '' }));
    try {
      const result = await updateMatch(matchId, {
        roomId: roomForm.roomId.trim() || null,
        roomPassword: roomForm.roomPassword.trim() || null,
        instructions: roomForm.instructions.trim() || null,
      });
      setMatch(result.match);
      setState({ loading: false, submitting: false, notice: 'Match room credentials saved.', error: '' });
    } catch (error) {
      setState((s) => ({ ...s, submitting: false, error: error.message }));
    }
  };

  // Save Schedule & Timing
  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    setState((s) => ({ ...s, submitting: true, error: '', notice: '' }));
    try {
      const result = await updateMatch(matchId, {
        scheduledAt: scheduleForm.scheduledAt || null,
        checkInAt: scheduleForm.checkInAt || null,
        lobbyOpenAt: scheduleForm.lobbyOpenAt || null,
      });
      setMatch(result.match);
      setState({ loading: false, submitting: false, notice: 'Match timing schedule updated.', error: '' });
    } catch (error) {
      setState((s) => ({ ...s, submitting: false, error: error.message }));
    }
  };

  // Notify Teams
  const handleNotifyTeams = async () => {
    setState((s) => ({ ...s, submitting: true, error: '', notice: '' }));
    try {
      const res = await notifyMatchSchedule(matchId);
      setState({
        loading: false,
        submitting: false,
        notice: `Match credentials and schedule broadcasted to ${res.recipientsCount || 'all group'} players.`,
        error: '',
      });
    } catch (error) {
      setState((s) => ({ ...s, submitting: false, error: error.message }));
    }
  };

  // Submit Result Score
  async function handleScoreSubmit(event) {
    event.preventDefault();
    if (!scoreForm.teamId) {
      setState((s) => ({ ...s, error: 'Please select a team before submitting.', notice: '' }));
      return;
    }
    setState((s) => ({ ...s, submitting: true, error: '', notice: '' }));
    try {
      const result = await createResult(matchId, scoreForm);
      setResults((current) => [...current, result.result]);
      setScoreForm({ teamId: '', points: 0, kills: 0, placement: '', resultText: '', resultMedia: null });
      setFileKey(Date.now());

      // Auto recalculate leaderboard
      const lbRes = await recalculateLeaderboard(matchId);
      setLeaderboard(lbRes.leaderboard || []);

      setState({
        loading: false,
        submitting: false,
        error: '',
        notice: `Result recorded for ${result.result.teamName}. Leaderboard updated.`,
      });
    } catch (error) {
      let errorMessage = error.message;
      if (error.details?.body) {
        errorMessage = Object.values(error.details.body).join(' · ');
      } else if (error.details && typeof error.details === 'object') {
        errorMessage = Object.values(error.details).join(' · ');
      }
      setState((s) => ({ ...s, submitting: false, error: errorMessage || 'Failed to save result.', notice: '' }));
    }
  }

  async function handleRecalculate() {
    setState((s) => ({ ...s, submitting: true, error: '', notice: '' }));
    try {
      const result = await recalculateLeaderboard(matchId);
      setLeaderboard(result.leaderboard || []);
      setState({ loading: false, submitting: false, error: '', notice: 'Leaderboard recalculated successfully.' });
    } catch (error) {
      setState((s) => ({ ...s, submitting: false, error: error.message || 'Failed to recalculate leaderboard.' }));
    }
  }

  // Delete Match
  const handleDeleteMatch = async () => {
    setState((s) => ({ ...s, submitting: true, error: '', notice: '' }));
    try {
      await deleteMatch(matchId);
      const effectiveRound = match.roundId || roundId;
      const effectiveGrp = match.groupId || groupId;
      navigate(`/organizer/tournaments/${tournamentId}/rounds/${effectiveRound}/groups/${effectiveGrp}`);
    } catch (error) {
      setState((s) => ({ ...s, submitting: false, error: error.message }));
    }
  };

  if (state.loading) {
    return (
      <section className="workspace-page">
        <p className="status-panel">Loading match workspace...</p>
      </section>
    );
  }

  if (!match) {
    return (
      <section className="workspace-page">
        <Link className="text-link" to={`/organizer/tournaments/${tournamentId}`}>
          Back to tournament
        </Link>
        <div className="form-alert" role="alert" style={{ marginTop: '20px' }}>
          {state.error || 'Match not found.'}
        </div>
      </section>
    );
  }

  const effectiveRoundId = roundId || match.roundId || group?.roundId;
  const effectiveGroupId = groupId || match.groupId;
  const unassignedTeams = teams.filter((team) => !results.some((result) => String(result.teamId) === String(team.id)));

  return (
    <section className="workspace-page organizer-match-workspace">
      {/* Hierarchical Breadcrumb Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#91a0b3', marginBottom: '16px', flexWrap: 'wrap' }}>
        <Link className="text-link" to="/organizer/tournaments">Tournaments</Link>
        <span>/</span>
        <Link className="text-link" to={`/organizer/tournaments/${tournamentId}`}>{match.tournamentName || 'Tournament Hub'}</Link>
        <span>/</span>
        <Link className="text-link" to={`/organizer/tournaments/${tournamentId}/rounds/${effectiveRoundId}`}>
          {match.roundName || `Round ${match.roundNumber || ''}`}
        </Link>
        <span>/</span>
        <Link className="text-link" to={`/organizer/tournaments/${tournamentId}/rounds/${effectiveRoundId}/groups/${effectiveGroupId}`}>
          {match.groupName || group?.name || 'Group Workspace'}
        </Link>
        <span>/</span>
        <span style={{ color: '#fff', fontWeight: 'bold' }}>{match.name}</span>
      </div>

      {/* Match Header Banner */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(28, 33, 40, 0.95), rgba(13, 17, 23, 0.98))',
        border: '1px solid rgba(125, 211, 252, 0.2)',
        borderRadius: '10px',
        padding: '24px',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span className={`status-badge ${match.status.toLowerCase()}`}>
                {match.status}
              </span>
              <span style={{ fontSize: '13px', color: '#7dd3fc' }}>
                Match #{match.matchNumber} · {match.groupName || group?.name || 'Group Stage'}
              </span>
            </div>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '28px', color: '#fff' }}>{match.name}</h1>
            <p style={{ margin: 0, color: '#91a0b3', fontSize: '14px' }}>
              Manage lobby room credentials, timing schedule, player notifications, and result scoring.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {match.status === 'SCHEDULED' && (
              <button
                className="button primary-button"
                onClick={() => handleSetStatus('LIVE')}
                disabled={state.submitting}
              >
                Start Match (LIVE)
              </button>
            )}
            {match.status === 'LIVE' && (
              <button
                className="button secondary-button"
                style={{ color: '#f6c453', borderColor: 'rgba(246, 196, 83, 0.4)' }}
                onClick={() => handleSetStatus('COMPLETED')}
                disabled={state.submitting}
              >
                Complete Match
              </button>
            )}
            <button
              className="button ghost-button"
              onClick={handleNotifyTeams}
              disabled={state.submitting}
              title="Broadcast match time and credentials to group players"
            >
              Send Match Details to Teams
            </button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {state.error && <div className="form-alert" role="alert" style={{ marginBottom: '16px' }}>{state.error}</div>}
      {state.notice && <div className="success-alert" role="status" style={{ marginBottom: '16px' }}>{state.notice}</div>}

      {/* 2-Column Match Configuration (Room Credentials + Scheduling) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Match Room Credentials */}
        <form onSubmit={handleSaveRoom} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#7dd3fc' }}>Match Room Credentials</h3>
          
          <label htmlFor="match-room-id" style={{ display: 'block', fontSize: '13px', color: '#91a0b3', marginBottom: '4px' }}>
            In-Game Room ID
          </label>
          <input
            id="match-room-id"
            style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 10px', marginBottom: '12px' }}
            value={roomForm.roomId}
            onChange={(e) => setRoomForm({ ...roomForm, roomId: e.target.value })}
            placeholder="e.g. 9823140"
          />

          <label htmlFor="match-room-pass" style={{ display: 'block', fontSize: '13px', color: '#91a0b3', marginBottom: '4px' }}>
            Room Password
          </label>
          <input
            id="match-room-pass"
            style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 10px', marginBottom: '12px' }}
            value={roomForm.roomPassword}
            onChange={(e) => setRoomForm({ ...roomForm, roomPassword: e.target.value })}
            placeholder="e.g. game123"
          />

          <label htmlFor="match-instructions" style={{ display: 'block', fontSize: '13px', color: '#91a0b3', marginBottom: '4px' }}>
            Room Instructions / Notes (Optional)
          </label>
          <textarea
            id="match-instructions"
            rows="2"
            style={{ width: '100%', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '8px 10px', marginBottom: '16px' }}
            value={roomForm.instructions}
            onChange={(e) => setRoomForm({ ...roomForm, instructions: e.target.value })}
            placeholder="e.g. Join assigned slot 5 minutes before start"
          />

          <button className="button primary-button" type="submit" disabled={state.submitting}>
            Save Room Credentials
          </button>
        </form>

        {/* Match Scheduling & Timeline */}
        <form onSubmit={handleSaveSchedule} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#7dd3fc' }}>Schedule & Timing</h3>

          <label htmlFor="match-sched-time" style={{ display: 'block', fontSize: '13px', color: '#91a0b3', marginBottom: '4px' }}>
            Match Start Time
          </label>
          <input
            id="match-sched-time"
            type="datetime-local"
            style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px', marginBottom: '12px' }}
            value={scheduleForm.scheduledAt}
            onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledAt: e.target.value })}
          />

          <label htmlFor="match-checkin-time" style={{ display: 'block', fontSize: '13px', color: '#91a0b3', marginBottom: '4px' }}>
            Check-In Time (Optional)
          </label>
          <input
            id="match-checkin-time"
            type="datetime-local"
            style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px', marginBottom: '12px' }}
            value={scheduleForm.checkInAt}
            onChange={(e) => setScheduleForm({ ...scheduleForm, checkInAt: e.target.value })}
          />

          <label htmlFor="match-lobby-time" style={{ display: 'block', fontSize: '13px', color: '#91a0b3', marginBottom: '4px' }}>
            Lobby Open Time (Optional)
          </label>
          <input
            id="match-lobby-time"
            type="datetime-local"
            style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 8px', marginBottom: '16px' }}
            value={scheduleForm.lobbyOpenAt}
            onChange={(e) => setScheduleForm({ ...scheduleForm, lobbyOpenAt: e.target.value })}
          />

          <button className="button primary-button" type="submit" disabled={state.submitting}>
            Save Schedule
          </button>
        </form>
      </div>

      {/* Results & Leaderboard Scoring Section */}
      <div className="competition-layout">
        {/* Score Submission Form */}
        <form className="team-form" onSubmit={handleScoreSubmit}>
          <h2>Record Result</h2>
          <label htmlFor="result-team">Team</label>
          <select
            id="result-team"
            value={scoreForm.teamId}
            onChange={(e) => setScoreForm({ ...scoreForm, teamId: e.target.value })}
            disabled={state.submitting || match.status === 'COMPLETED'}
            required
          >
            <option value="">Select assigned team</option>
            {unassignedTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>

          <label htmlFor="result-points">Points</label>
          <input
            id="result-points"
            type="number"
            min="0"
            step="0.01"
            value={scoreForm.points}
            onChange={(e) => setScoreForm({ ...scoreForm, points: e.target.value })}
            disabled={state.submitting || match.status === 'COMPLETED'}
            required
          />

          <label htmlFor="result-kills">Kills</label>
          <input
            id="result-kills"
            type="number"
            min="0"
            value={scoreForm.kills}
            onChange={(e) => setScoreForm({ ...scoreForm, kills: e.target.value })}
            disabled={state.submitting || match.status === 'COMPLETED'}
            required
          />

          <label htmlFor="result-placement">Placement <span>(optional)</span></label>
          <input
            id="result-placement"
            type="number"
            min="1"
            value={scoreForm.placement}
            onChange={(e) => setScoreForm({ ...scoreForm, placement: e.target.value })}
            disabled={state.submitting || match.status === 'COMPLETED'}
          />

          <label htmlFor="result-text">Notes <span>(optional)</span></label>
          <textarea
            id="result-text"
            rows="3"
            value={scoreForm.resultText}
            onChange={(e) => setScoreForm({ ...scoreForm, resultText: e.target.value })}
            disabled={state.submitting || match.status === 'COMPLETED'}
          />

          <label htmlFor="result-media">Screenshot Proof <span>(optional, image)</span></label>
          <input
            key={fileKey}
            id="result-media"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setScoreForm({ ...scoreForm, resultMedia: e.target.files?.[0] || null })}
            disabled={state.submitting || match.status === 'COMPLETED'}
          />

          <button className="button primary-button" type="submit" disabled={state.submitting || match.status === 'COMPLETED'}>
            {state.submitting ? 'Saving result...' : 'Save Result'}
          </button>
        </form>

        {/* Leaderboard & Results Table */}
        <div className="team-list">
          <div className="section-heading">
            <h2>Match Standings</h2>
            <button className="button secondary-button" type="button" onClick={handleRecalculate} disabled={state.submitting || !results.length}>
              Recalculate Leaderboard
            </button>
          </div>

          {!leaderboard.length && <p className="empty-state">No leaderboard entries calculated yet.</p>}
          {leaderboard.map((entry) => (
            <div className="competition-item" key={entry.teamId}>
              <div>
                <span className="tournament-status">Rank {entry.rank}</span>
                <h3>{entry.teamName}</h3>
              </div>
              <strong>{entry.points} pts · {entry.kills} kills</strong>
            </div>
          ))}

          <h2 style={{ marginTop: '24px' }}>Results Recorded ({results.length})</h2>
          {!results.length && <p className="empty-state">No results entered yet.</p>}
          {results.map((res) => (
            <div className="competition-item" key={res.id}>
              <div>
                <h3>{res.teamName}</h3>
                <p>
                  {res.points} points · {res.kills} kills
                  {res.placement ? ` · Place #${res.placement}` : ''}
                </p>
              </div>
              <span>{res.hasMedia ? 'Proof attached' : 'No proof'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Match Danger Zone (Delete Match) */}
      {match.status !== 'COMPLETED' && (
        <div style={{ marginTop: '30px', background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#ef4444', fontSize: '16px' }}>Delete Match</h3>
          <p style={{ color: '#91a0b3', fontSize: '13px', margin: '0 0 16px 0' }}>
            Deleting a match is only allowed if no results have been entered. Once results exist, clear results first before removing the match.
          </p>
          <button
            className="button danger-button"
            type="button"
            onClick={() => setDeleteConfirm(true)}
          >
            Delete This Match
          </button>
        </div>
      )}

      {/* Delete Match Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '20px' }}>
          <div style={{ background: '#1c2128', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px', padding: '24px', width: 'min(420px, 100%)' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#ef4444' }}>Confirm Match Deletion</h3>
            <p style={{ color: '#cdd6e2', fontSize: '14px', marginBottom: '16px' }}>
              Are you sure you want to delete <strong>{match.name}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="button ghost-button" type="button" onClick={() => setDeleteConfirm(false)}>
                Cancel
              </button>
              <button className="button danger-button" type="button" onClick={handleDeleteMatch} disabled={state.submitting}>
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
