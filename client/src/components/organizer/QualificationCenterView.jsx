import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

export function QualificationCenterView({
  tournamentId,
  round,
  groups = [],
  qualifications = [],
  isSubmitting = false,
  onFinalize,
  onReopen,
  onCreateNextRound,
}) {
  // Map of groupId -> Set of selected team IDs
  const [selectedMap, setSelectedMap] = useState(() => {
    const map = new Map();
    for (const q of qualifications) {
      const gId = q.sourceGroupId || 'unassigned';
      if (!map.has(gId)) map.set(gId, new Set());
      map.get(gId).add(Number(q.teamId));
    }
    return map;
  });

  const [topNInput, setTopNInput] = useState(4);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);

  const isFinalized = Boolean(round?.qualificationsFinalizedAt);
  const allGroupsCompleted = groups.length > 0 && groups.every((g) => g.status === 'COMPLETED');

  // Total selected across all groups
  const totalSelectedCount = useMemo(() => {
    let total = 0;
    for (const set of selectedMap.values()) {
      total += set.size;
    }
    return total;
  }, [selectedMap]);

  // Handle single team qualification toggle
  const toggleTeamQualification = (groupId, teamId, rank) => {
    if (isFinalized) return;
    setSelectedMap((prev) => {
      const next = new Map(prev);
      const gSet = new Set(next.get(groupId) || []);
      const numId = Number(teamId);

      if (gSet.has(numId)) {
        gSet.delete(numId);
      } else {
        gSet.add(numId);
      }

      next.set(groupId, gSet);
      return next;
    });
  };

  // Quick Select Top N for a group
  const selectTopNForGroup = (group, n) => {
    if (isFinalized) return;
    const leaderboard = group.leaderboard || [];
    const topTeams = leaderboard.slice(0, n);

    setSelectedMap((prev) => {
      const next = new Map(prev);
      const gSet = new Set(topTeams.map((t) => Number(t.teamId)));
      next.set(group.id, gSet);
      return next;
    });
  };

  // Quick Select Top N for all groups
  const selectTopNForAllGroups = (n) => {
    if (isFinalized) return;
    setSelectedMap((prev) => {
      const next = new Map(prev);
      for (const group of groups) {
        const topTeams = (group.leaderboard || []).slice(0, n);
        next.set(group.id, new Set(topTeams.map((t) => Number(t.teamId))));
      }
      return next;
    });
  };

  // Compile final selections payload
  const compiledSelections = useMemo(() => {
    const list = [];
    for (const group of groups) {
      const gSet = selectedMap.get(group.id) || new Set();
      const leaderboard = group.leaderboard || [];

      for (let idx = 0; idx < leaderboard.length; idx++) {
        const entry = leaderboard[idx];
        if (gSet.has(Number(entry.teamId))) {
          list.push({
            teamId: Number(entry.teamId),
            teamName: entry.teamName,
            sourceGroupId: group.id,
            sourceGroupName: group.name,
            rankAtQualification: entry.rank || idx + 1,
            points: entry.points,
            kills: entry.kills,
          });
        }
      }
    }
    return list;
  }, [groups, selectedMap]);

  const handleFinalizeSubmit = () => {
    setShowReviewModal(false);
    onFinalize({
      selections: compiledSelections.map((s) => ({
        teamId: s.teamId,
        sourceGroupId: s.sourceGroupId,
        rankAtQualification: s.rankAtQualification,
      })),
    });
  };

  return (
    <div className="qualification-center-container">
      {/* Header & Status Summary */}
      <div className="qualification-header-card">
        <div className="header-primary-col">
          <span className="page-kicker">Round {round?.roundNumber} Standings & Progression</span>
          <h2 className="header-title">Qualification Center</h2>
          <p className="header-subtitle">
            Select top performers from each group to advance to the next round.
          </p>
        </div>

        <div className="header-stats-col">
          <div className="stat-pill">
            <span className="stat-label">Group Completion</span>
            <strong className={`stat-value ${allGroupsCompleted ? 'text-success' : 'text-warning'}`}>
              {groups.filter((g) => g.status === 'COMPLETED').length} / {groups.length} Completed
            </strong>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Qualified Teams</span>
            <strong className="stat-value">{totalSelectedCount} Selected</strong>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Qualification Status</span>
            <span className={`status-badge ${isFinalized ? 'completed' : 'draft'}`}>
              {isFinalized ? 'FINALIZED' : 'IN PROGRESS'}
            </span>
          </div>
        </div>
      </div>

      {/* Global Action Bar */}
      <div className="qualification-action-bar">
        {!isFinalized ? (
          <div className="quick-select-strip">
            <label htmlFor="top-n-input">Quick Select Top:</label>
            <input
              id="top-n-input"
              type="number"
              min="1"
              max="20"
              value={topNInput}
              onChange={(e) => setTopNInput(Math.max(1, Number(e.target.value)))}
              className="top-n-input"
            />
            <button
              className="button secondary-button"
              type="button"
              onClick={() => selectTopNForAllGroups(topNInput)}
              disabled={isSubmitting || groups.length === 0}
            >
              Apply Top {topNInput} to All Groups
            </button>
          </div>
        ) : (
          <div className="finalized-notice-strip">
            <span>Qualifications have been finalized for Round {round?.roundNumber}.</span>
          </div>
        )}

        <div className="action-buttons-group">
          {!isFinalized ? (
            <button
              className="button primary-button finalize-btn"
              type="button"
              onClick={() => setShowReviewModal(true)}
              disabled={isSubmitting || totalSelectedCount === 0 || !allGroupsCompleted}
              title={!allGroupsCompleted ? 'All groups must be completed first' : ''}
            >
              Review & Finalize ({totalSelectedCount})
            </button>
          ) : (
            <>
              <button
                className="button secondary-button"
                type="button"
                onClick={() => setShowReopenModal(true)}
                disabled={isSubmitting}
              >
                Reopen Qualification
              </button>
              <button
                className="button primary-button next-round-btn"
                type="button"
                onClick={onCreateNextRound}
                disabled={isSubmitting}
              >
                Create Next Round
              </button>
            </>
          )}
        </div>
      </div>

      {!allGroupsCompleted && !isFinalized && (
        <div className="alert-box alert-warning">
          <strong>Notice:</strong> Some groups are still in progress. You can preselect qualifying
          teams, but qualifications cannot be finalized until all group matches and standings are
          completed.
        </div>
      )}

      {/* Groups Standings & Selection List */}
      <div className="groups-standings-grid">
        {groups.map((group) => {
          const gSet = selectedMap.get(group.id) || new Set();
          const leaderboard = group.leaderboard || [];

          return (
            <div key={group.id} className="group-standings-card">
              <div className="group-standings-header">
                <div>
                  <h3 className="group-standings-title">{group.name}</h3>
                  <span className="group-standings-meta">
                    {group.teams?.length || 0} Teams · Status: {group.status.replaceAll('_', ' ')}
                  </span>
                </div>

                <div className="group-header-right">
                  <span className="qualified-count-badge">
                    {gSet.size} Selected
                  </span>
                  {!isFinalized && leaderboard.length > 0 && (
                    <button
                      className="button secondary-button mini-btn"
                      type="button"
                      onClick={() => selectTopNForGroup(group, topNInput)}
                    >
                      Top {topNInput}
                    </button>
                  )}
                </div>
              </div>

              <div className="group-standings-table-wrap">
                {leaderboard.length === 0 ? (
                  <p className="empty-state-text">No match results published yet for this group.</p>
                ) : (
                  <table className="esports-table qualification-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>Adv</th>
                        <th style={{ width: '50px' }}>Rank</th>
                        <th>Team Name</th>
                        <th style={{ textAlign: 'center', width: '60px' }}>Kills</th>
                        <th style={{ textAlign: 'right', width: '70px' }}>Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((row, idx) => {
                        const rank = row.rank || idx + 1;
                        const isSelected = gSet.has(Number(row.teamId));

                        return (
                          <tr
                            key={row.teamId}
                            className={`standings-row ${isSelected ? 'is-qualifier-row' : ''}`}
                            onClick={() => toggleTeamQualification(group.id, row.teamId, rank)}
                          >
                            <td className="checkbox-cell">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // Handled by row click
                                disabled={isFinalized}
                                aria-label={`Qualify ${row.teamName}`}
                              />
                            </td>
                            <td className="rank-cell">
                              <span className={`rank-badge rank-${rank <= 3 ? rank : 'other'}`}>
                                #{rank}
                              </span>
                            </td>
                            <td className="team-cell">
                              <strong>{row.teamName}</strong>
                            </td>
                            <td className="kills-cell" style={{ textAlign: 'center' }}>
                              {row.kills}
                            </td>
                            <td className="points-cell" style={{ textAlign: 'right' }}>
                              <strong>{row.points}</strong>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Review & Finalize Confirmation Modal */}
      {showReviewModal && (
        <div className="modal-backdrop">
          <div className="modal-content modal-large">
            <h3>Review Round {round?.roundNumber} Qualifications</h3>
            <p>
              The following <strong>{compiledSelections.length} teams</strong> will be officially
              qualified to enter the next round:
            </p>

            <div className="modal-roster-summary">
              {groups.map((group) => {
                const groupQualifiers = compiledSelections.filter((s) => s.sourceGroupId === group.id);
                return (
                  <div key={group.id} className="summary-group-block">
                    <h4>{group.name} ({groupQualifiers.length} Qualified)</h4>
                    {groupQualifiers.length === 0 ? (
                      <span className="text-warning">No teams selected from this group.</span>
                    ) : (
                      <ul className="summary-qualifiers-list">
                        {groupQualifiers.map((team) => (
                          <li key={team.teamId}>
                            <span>#{team.rankAtQualification} {team.teamName}</span>
                            <small>{team.points} pts</small>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="modal-actions">
              <button
                className="button secondary-button"
                type="button"
                onClick={() => setShowReviewModal(false)}
                disabled={isSubmitting}
              >
                Back to Editing
              </button>
              <button
                className="button primary-button"
                type="button"
                onClick={handleFinalizeSubmit}
                disabled={isSubmitting || compiledSelections.length === 0}
              >
                {isSubmitting ? 'Finalizing...' : 'Confirm & Finalize Qualification'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Confirmation Modal */}
      {showReopenModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3>Reopen Qualification for Round {round?.roundNumber}?</h3>
            <p>
              This will re-enable qualification editing. Note: if Next Round groups have already
              started, qualification cannot be reopened.
            </p>
            <div className="modal-actions">
              <button
                className="button secondary-button"
                type="button"
                onClick={() => setShowReopenModal(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className="button danger-button"
                type="button"
                onClick={() => {
                  setShowReopenModal(false);
                  onReopen();
                }}
                disabled={isSubmitting}
              >
                Confirm Reopen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
