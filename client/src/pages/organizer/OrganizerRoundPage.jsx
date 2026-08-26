import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  completeRound,
  createGroup,
  deleteGroup,
  fetchGroups,
  getRound,
  updateRound,
} from '../../services/competitionApi.js';

export function OrganizerRoundPage() {
  const { tournamentId, roundId } = useParams();
  const navigate = useNavigate();

  const [round, setRound] = useState(null);
  const [groups, setGroups] = useState([]);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [newGroupForm, setNewGroupForm] = useState({ name: '', groupSize: 12 });
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState(null);

  const [state, setState] = useState({
    loading: true,
    actionLoading: false,
    error: '',
    notice: '',
  });

  const loadData = useCallback(async () => {
    if (!roundId || Number.isNaN(Number(roundId))) {
      setState({ loading: false, actionLoading: false, error: 'Invalid round ID', notice: '' });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: '', notice: '' }));
    try {
      const [roundRes, groupRes] = await Promise.all([
        getRound(roundId).catch(() => ({ round: null })),
        fetchGroups(roundId),
      ]);

      if (roundRes?.round) {
        setRound(roundRes.round);
      }
      setGroups(groupRes.groups || []);
      setState({ loading: false, actionLoading: false, error: '', notice: '' });
    } catch (error) {
      setState({ loading: false, actionLoading: false, error: error.message, notice: '' });
    }
  }, [roundId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStartRound = async () => {
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const result = await updateRound(roundId, { status: 'IN_PROGRESS' });
      setRound((prev) => ({ ...prev, ...result.round }));
      setState({
        loading: false,
        actionLoading: false,
        error: '',
        notice: 'Round is now LIVE (IN_PROGRESS).',
      });
    } catch (error) {
      setState((s) => ({ ...s, actionLoading: false, error: error.message }));
    }
  };

  const handleCompleteRound = async () => {
    if (!window.confirm('Mark this round as COMPLETED? Ensure all groups and matches have concluded and qualifications are finalized.')) return;
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const result = await completeRound(roundId);
      setRound((prev) => ({ ...prev, ...result.round }));
      setState({
        loading: false,
        actionLoading: false,
        error: '',
        notice: 'Round marked as COMPLETED.',
      });
    } catch (error) {
      setState((s) => ({ ...s, actionLoading: false, error: error.message }));
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupForm.name.trim()) return;
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const result = await createGroup(roundId, {
        name: newGroupForm.name.trim(),
        groupSize: Number(newGroupForm.groupSize) || 12,
      });
      setGroups((prev) => [...prev, result.group]);
      setNewGroupForm({ name: '', groupSize: 12 });
      setShowAddGroupModal(false);
      setState({
        loading: false,
        actionLoading: false,
        error: '',
        notice: `Group ${result.group.name} created.`,
      });
    } catch (error) {
      setState((s) => ({ ...s, actionLoading: false, error: error.message }));
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteConfirmGroup) return;
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      await deleteGroup(deleteConfirmGroup.id);
      setGroups((prev) => prev.filter((g) => g.id !== deleteConfirmGroup.id));
      const groupName = deleteConfirmGroup.name;
      setDeleteConfirmGroup(null);
      setState({
        loading: false,
        actionLoading: false,
        error: '',
        notice: `Group "${groupName}" deleted. Assigned teams have been returned to the unassigned pool.`,
      });
    } catch (error) {
      setState((s) => ({ ...s, actionLoading: false, error: error.message }));
    }
  };

  if (state.loading) {
    return (
      <section className="workspace-page">
        <p className="status-panel">Loading round control center...</p>
      </section>
    );
  }

  if (!round) {
    return (
      <section className="workspace-page">
        <Link className="text-link" to={`/organizer/tournaments/${tournamentId}?tab=rounds`}>
          Back to tournament rounds
        </Link>
        <div className="form-alert" role="alert" style={{ marginTop: '20px' }}>
          {state.error || 'Round not found.'}
        </div>
      </section>
    );
  }

  const stats = round.stats || {
    totalGroups: groups.length,
    completedGroups: groups.filter((g) => g.status === 'COMPLETED').length,
    totalTeams: groups.reduce((acc, g) => acc + (g.teams?.length || 0), 0),
    totalMatches: groups.reduce((acc, g) => acc + (g.matches?.length || 0), 0),
    completedMatches: groups.reduce(
      (acc, g) => acc + (g.matches?.filter((m) => m.status === 'COMPLETED').length || 0),
      0
    ),
    liveMatches: groups.reduce(
      (acc, g) => acc + (g.matches?.filter((m) => m.status === 'LIVE').length || 0),
      0
    ),
    qualifiedTeams: 0,
  };

  const matchPercent = stats.totalMatches > 0
    ? Math.round((stats.completedMatches / stats.totalMatches) * 100)
    : 0;

  return (
    <section className="workspace-page organizer-round-control-center">
      {/* Breadcrumb Navigation */}
      <div className="breadcrumb-nav" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#91a0b3', marginBottom: '16px' }}>
        <Link className="text-link" to="/organizer/tournaments">Tournaments</Link>
        <span>/</span>
        <Link className="text-link" to={`/organizer/tournaments/${tournamentId}`}>{round.tournamentName || 'Tournament Hub'}</Link>
        <span>/</span>
        <Link className="text-link" to={`/organizer/tournaments/${tournamentId}?tab=rounds`}>Rounds</Link>
        <span>/</span>
        <span style={{ color: '#fff', fontWeight: 'bold' }}>{round.name || `Round ${round.roundNumber}`}</span>
      </div>

      {/* Round Header Banner */}
      <div className="round-header-banner" style={{
        background: 'linear-gradient(180deg, rgba(28, 33, 40, 0.95), rgba(13, 17, 23, 0.98))',
        border: '1px solid rgba(125, 211, 252, 0.2)',
        borderRadius: '10px',
        padding: '24px',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span className={`status-badge ${round.status.toLowerCase()}`}>
                {round.status.replaceAll('_', ' ')}
              </span>
              <span style={{ fontSize: '13px', color: '#7dd3fc' }}>
                Stage: {round.assignmentStatus || 'DRAFT'} {round.isLocked ? '(LOCKED)' : ''}
              </span>
            </div>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '28px', color: '#fff' }}>
              {round.name || `Round ${round.roundNumber}`} Control Center
            </h1>
            <p style={{ margin: 0, color: '#91a0b3', fontSize: '14px' }}>
              Manage stage progress, view group workspaces, configure team distribution, and select qualifying teams.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Link
              className="button secondary-button"
              to={`/organizer/tournaments/${tournamentId}/rounds/${roundId}/groups`}
            >
              Configure Team Distribution
            </Link>
            <Link
              className="button ghost-button"
              to={`/organizer/tournaments/${tournamentId}/rounds/${roundId}/qualifications`}
            >
              Qualification Center
            </Link>

            {round.status === 'NOT_STARTED' && (
              <button
                className="button primary-button"
                onClick={handleStartRound}
                disabled={state.actionLoading}
              >
                Start Round (LIVE)
              </button>
            )}

            {round.status === 'IN_PROGRESS' && (
              <button
                className="button secondary-button"
                style={{ color: '#f6c453', borderColor: 'rgba(246, 196, 83, 0.4)' }}
                onClick={handleCompleteRound}
                disabled={state.actionLoading}
              >
                Complete Round
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Feedback Alerts */}
      {state.error && <div className="form-alert" role="alert" style={{ marginBottom: '16px' }}>{state.error}</div>}
      {state.notice && <div className="success-alert" role="status" style={{ marginBottom: '16px' }}>{state.notice}</div>}

      {/* Operational Summary Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#91a0b3', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Groups</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff', marginTop: '6px' }}>
            {stats.completedGroups} / {stats.totalGroups}
            <span style={{ fontSize: '13px', color: '#91a0b3', marginLeft: '6px' }}>Completed</span>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#91a0b3', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assigned Teams</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#7dd3fc', marginTop: '6px' }}>
            {stats.totalTeams}
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#91a0b3', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Matches</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff', marginTop: '6px' }}>
            {stats.completedMatches} / {stats.totalMatches}
            <span style={{ fontSize: '13px', color: stats.liveMatches > 0 ? '#2ecc71' : '#91a0b3', marginLeft: '6px' }}>
              ({stats.liveMatches} LIVE)
            </span>
          </div>
          <div style={{ marginTop: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
            <div style={{ width: `${matchPercent}%`, background: '#7dd3fc', height: '100%', transition: 'width 0.3s' }} />
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#91a0b3', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Qualified Teams</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: stats.qualifiedTeams > 0 ? '#2ecc71' : '#f6c453', marginTop: '6px' }}>
            {stats.qualifiedTeams}
          </div>
        </div>
      </div>

      {/* Groups Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>Groups ({groups.length})</h2>
          <p style={{ margin: '4px 0 0 0', color: '#91a0b3', fontSize: '13px' }}>
            Select a group to enter its workspace, manage match scheduling, configure lobbies, and score games.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="button secondary-button"
            type="button"
            onClick={() => setShowAddGroupModal(true)}
            disabled={round.status === 'COMPLETED'}
          >
            + Add Group
          </button>
        </div>
      </div>

      {/* Groups Grid */}
      {groups.length === 0 ? (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '32px', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#fff' }}>No groups created yet</h3>
          <p style={{ color: '#91a0b3', marginBottom: '20px' }}>
            Generate balanced groups using the automated team distribution wizard or create custom groups manually.
          </p>
          <Link
            className="button primary-button"
            to={`/organizer/tournaments/${tournamentId}/rounds/${roundId}/groups`}
          >
            Configure Team Distribution
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {groups.map((group) => {
            const teamCount = group.teams?.length || 0;
            const matchCount = group.matches?.length || 0;
            const completedCount = group.matches?.filter((m) => m.status === 'COMPLETED').length || 0;
            const liveMatch = group.matches?.find((m) => m.status === 'LIVE');

            return (
              <div
                key={group.id}
                style={{
                  background: 'rgba(28, 33, 40, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>{group.name}</h3>
                      <span style={{ fontSize: '12px', color: '#91a0b3' }}>
                        Capacity: {teamCount} / {group.groupSize || 12} Teams
                      </span>
                    </div>
                    <span className={`status-badge ${group.status.toLowerCase()}`}>
                      {group.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#cdd6e2', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#91a0b3' }}>Matches:</span>
                      <strong>{completedCount} / {matchCount} Completed</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#91a0b3' }}>Room Status:</span>
                      <span style={{ color: group.roomId ? '#2ecc71' : '#f6c453' }}>
                        {group.roomId ? 'Configured' : 'Awaiting Room ID'}
                      </span>
                    </div>
                    {liveMatch && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2ecc71', fontWeight: 'bold' }}>
                        <span>Active:</span>
                        <span>{liveMatch.name} (LIVE)</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                  <Link
                    className="button primary-button"
                    style={{ flex: 1, minHeight: '34px', padding: '0 12px', fontSize: '13px' }}
                    to={`/organizer/tournaments/${tournamentId}/rounds/${roundId}/groups/${group.id}`}
                  >
                    Open Group Workspace
                  </Link>

                  {round.status !== 'COMPLETED' && (
                    <button
                      className="button ghost-button danger-text"
                      style={{ minHeight: '34px', padding: '0 10px', fontSize: '12px' }}
                      type="button"
                      onClick={() => setDeleteConfirmGroup(group)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Custom Group Modal */}
      {showAddGroupModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '20px' }}>
          <form onSubmit={handleCreateGroup} style={{ background: '#1c2128', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '24px', width: 'min(420px, 100%)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#fff' }}>Add Custom Group</h3>

            <label htmlFor="round-new-group-name" style={{ display: 'block', fontSize: '13px', color: '#91a0b3', marginBottom: '4px' }}>Group Name</label>
            <input
              id="round-new-group-name"
              style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 10px', marginBottom: '15px' }}
              value={newGroupForm.name}
              onChange={(e) => setNewGroupForm({ ...newGroupForm, name: e.target.value })}
              placeholder="e.g. Group C"
              required
            />

            <label htmlFor="round-new-group-size" style={{ display: 'block', fontSize: '13px', color: '#91a0b3', marginBottom: '4px' }}>Target Capacity (Teams)</label>
            <input
              id="round-new-group-size"
              type="number"
              min="2"
              max="64"
              style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', padding: '0 10px', marginBottom: '20px' }}
              value={newGroupForm.groupSize}
              onChange={(e) => setNewGroupForm({ ...newGroupForm, groupSize: e.target.value })}
              required
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="button ghost-button"
                type="button"
                onClick={() => setShowAddGroupModal(false)}
              >
                Cancel
              </button>
              <button
                className="button primary-button"
                type="submit"
                disabled={state.actionLoading}
              >
                Create Group
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Group Confirmation Modal */}
      {deleteConfirmGroup && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '20px' }}>
          <div style={{ background: '#1c2128', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px', padding: '24px', width: 'min(450px, 100%)' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#ef4444' }}>Delete Group</h3>
            <p style={{ color: '#cdd6e2', fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>
              Are you sure you want to delete <strong>{deleteConfirmGroup.name}</strong>?
            </p>
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', padding: '12px', fontSize: '13px', color: '#fca5a5', marginBottom: '20px' }}>
              <strong>Safety Note:</strong> Deleting a group removes group-specific assignments and scheduled matches without results. The underlying registered teams and players remain fully preserved in the tournament.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="button ghost-button"
                type="button"
                onClick={() => setDeleteConfirmGroup(null)}
              >
                Cancel
              </button>
              <button
                className="button danger-button"
                type="button"
                onClick={handleDeleteGroup}
                disabled={state.actionLoading}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
