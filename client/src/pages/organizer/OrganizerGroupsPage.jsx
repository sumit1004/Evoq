import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  autoAssignGroups,
  bulkMoveTeams,
  createGroup,
  fetchEligibleTeams,
  fetchGroups,
  getRound,
  lockRoundAssignment,
} from '../../services/competitionApi.js';
import { RoundSetupWizard } from '../../components/organizer/RoundSetupWizard.jsx';
import { AssignmentWorkspace } from '../../components/organizer/AssignmentWorkspace.jsx';

export function OrganizerGroupsPage() {
  const { tournamentId, roundId } = useParams();
  const [round, setRound] = useState(null);
  const [groups, setGroups] = useState([]);
  const [eligibleTeams, setEligibleTeams] = useState([]);
  const [showManualCreate, setShowManualCreate] = useState(false);
  const [manualForm, setManualForm] = useState({ name: '', groupSize: 12 });
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
      const [roundRes, groupRes, teamRes] = await Promise.all([
        getRound(roundId).catch(() => ({ round: null })),
        fetchGroups(roundId),
        fetchEligibleTeams(roundId),
      ]);

      if (roundRes?.round) setRound(roundRes.round);
      setGroups(groupRes.groups || []);
      setEligibleTeams(teamRes.teams || []);
      setState({ loading: false, actionLoading: false, error: '', notice: '' });
    } catch (error) {
      setState({ loading: false, actionLoading: false, error: error.message, notice: '' });
    }
  }, [roundId]);


  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Auto Assignment Generation
  const handleGenerate = async (config) => {
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const result = await autoAssignGroups(roundId, config);
      if (result.round) setRound(result.round);
      setGroups(result.groups || []);
      setState({
        loading: false,
        actionLoading: false,
        error: '',
        notice: `Generated ${result.totalGroups} balanced groups for ${result.totalEligible} teams.`,
      });
    } catch (error) {
      setState((s) => ({ ...s, actionLoading: false, error: error.message }));
    }
  };

  // Handle Bulk Team Movement
  const handleBulkMove = async (payload) => {
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const result = await bulkMoveTeams(roundId, payload);
      setGroups(result.groups || []);
      setState({
        loading: false,
        actionLoading: false,
        error: '',
        notice: `Successfully moved ${payload.teamIds.length} teams.`,
      });
    } catch (error) {
      setState((s) => ({ ...s, actionLoading: false, error: error.message }));
    }
  };

  // Handle Lock Assignment
  const handleLock = async () => {
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const result = await lockRoundAssignment(roundId);
      if (result.round) setRound(result.round);
      setState({
        loading: false,
        actionLoading: false,
        error: '',
        notice: 'Group assignment is now officially locked. Teams cannot be moved.',
      });
    } catch (error) {
      setState((s) => ({ ...s, actionLoading: false, error: error.message }));
    }
  };

  // Handle Manual Group Creation
  const handleManualGroupSubmit = async (e) => {
    e.preventDefault();
    setState((s) => ({ ...s, actionLoading: true, error: '', notice: '' }));
    try {
      const result = await createGroup(roundId, {
        name: manualForm.name.trim(),
        groupSize: Number(manualForm.groupSize),
      });
      setGroups((current) => [...current, result.group]);
      setManualForm({ name: '', groupSize: 12 });
      setShowManualCreate(false);
      setState({
        loading: false,
        actionLoading: false,
        error: '',
        notice: `Created group ${result.group.name}.`,
      });
    } catch (error) {
      setState((s) => ({ ...s, actionLoading: false, error: error.message }));
    }
  };

  const isLocked = round?.isLocked || round?.assignmentStatus === 'LOCKED';

  return (
    <section className="workspace-page">
      <div className="workspace-nav-bar">
        <Link className="text-link" to={`/organizer/tournaments/${tournamentId}?tab=rounds`}>
          Back to tournament rounds
        </Link>
        <div className="nav-actions">
          <Link
            className="button ghost-button"
            to={`/organizer/tournaments/${tournamentId}/rounds/${roundId}/qualifications`}
          >
            Qualification Center
          </Link>
        </div>
      </div>

      <div className="page-header-row">
        <div>
          <div className="page-kicker">
            Round {round?.roundNumber || roundId} · {round?.status?.replaceAll('_', ' ') || 'Competition'}
          </div>
          <h1>{round?.name || `Round ${roundId}`} Groups</h1>
          <p>
            Configure balanced group distribution, preview assignments, adjust rosters, and lock
            groups before starting matches.
          </p>
        </div>
      </div>

      {state.error && <div className="form-alert" role="alert">{state.error}</div>}
      {state.notice && <div className="success-alert" role="status">{state.notice}</div>}

      {state.loading && <p className="status-panel">Loading round setup and teams...</p>}

      {!state.loading && (
        <div className="round-groups-layout">
          {/* If no groups exist yet or draft not locked, show setup wizard */}
          {(!isLocked || groups.length === 0) && (
            <RoundSetupWizard
              roundNumber={round?.roundNumber || 1}
              eligibleTeamsCount={eligibleTeams.length}
              isGenerating={state.actionLoading}
              isLocked={isLocked}
              onGenerate={handleGenerate}
            />
          )}

          {/* Manual Group Creation Accordion Toggle */}
          {!isLocked && (
            <div className="manual-create-strip">
              <button
                className="text-button"
                type="button"
                onClick={() => setShowManualCreate((v) => !v)}
              >
                {showManualCreate ? 'Hide manual group creator' : '+ Add custom group manually'}
              </button>

              {showManualCreate && (
                <form className="team-form inline-create-form" onSubmit={handleManualGroupSubmit}>
                  <div className="form-row">
                    <div>
                      <label htmlFor="custom-group-name">Group Name</label>
                      <input
                        id="custom-group-name"
                        value={manualForm.name}
                        onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                        placeholder="e.g. Group X"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="custom-group-size">Max Capacity</label>
                      <input
                        id="custom-group-size"
                        type="number"
                        min="2"
                        value={manualForm.groupSize}
                        onChange={(e) => setManualForm({ ...manualForm, groupSize: e.target.value })}
                        required
                      />
                    </div>
                    <div style={{ alignSelf: 'flex-end' }}>
                      <button
                        className="button secondary-button"
                        type="submit"
                        disabled={state.actionLoading}
                      >
                        Add Group
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Assignment Workspace & Group Panels */}
          {groups.length > 0 ? (
            <AssignmentWorkspace
              tournamentId={tournamentId}
              round={round}
              groups={groups}
              eligibleTeams={eligibleTeams}
              isActionLoading={state.actionLoading}
              onBulkMove={handleBulkMove}
              onLockAssignment={handleLock}
              onRegenerate={() =>
                handleGenerate({
                  mode: 'BY_SIZE',
                  targetGroupSize: groups[0]?.groupSize || 12,
                })
              }
            />
          ) : (
            <div className="empty-workspace-card">
              <h3>No groups generated yet</h3>
              <p>Use the Automated Group Setup above to calculate and preview balanced groups.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
