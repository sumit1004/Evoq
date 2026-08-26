import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

export function AssignmentWorkspace({
  tournamentId,
  round,
  groups = [],
  eligibleTeams = [],
  isActionLoading = false,
  onBulkMove,
  onLockAssignment,
  onRegenerate,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL'); // 'ALL' | 'ASSIGNED' | 'UNASSIGNED' | groupId
  const [selectedTeamIds, setSelectedTeamIds] = useState(new Set());
  const [targetGroupId, setTargetGroupId] = useState('');
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  const isLocked = round?.isLocked || round?.assignmentStatus === 'LOCKED';
  const isReadOnly = isLocked || round?.status === 'COMPLETED' || round?.status === 'IN_PROGRESS';

  // Map of teamId -> assigned group
  const assignedTeamMap = useMemo(() => {
    const map = new Map();
    for (const group of groups) {
      for (const team of group.teams || []) {
        map.set(String(team.id), {
          groupId: group.id,
          groupName: group.name,
          team,
        });
      }
    }
    return map;
  }, [groups]);

  // Total metrics
  const totalEligible = eligibleTeams.length;
  const totalAssigned = assignedTeamMap.size;
  const unassignedTeams = useMemo(() => {
    return eligibleTeams.filter((t) => !assignedTeamMap.has(String(t.id)));
  }, [eligibleTeams, assignedTeamMap]);

  // Duplicate assignments check
  const duplicateAssignments = useMemo(() => {
    const seen = new Set();
    const duplicates = [];
    for (const group of groups) {
      for (const team of group.teams || []) {
        if (seen.has(String(team.id))) {
          duplicates.push(team);
        } else {
          seen.add(String(team.id));
        }
      }
    }
    return duplicates;
  }, [groups]);

  // Filtered teams list
  const filteredTeamsByGroup = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const result = {};

    for (const group of groups) {
      const gTeams = (group.teams || []).filter((team) => {
        if (q && !team.name.toLowerCase().includes(q) && !String(team.id).includes(q)) {
          return false;
        }
        return true;
      });
      result[group.id] = gTeams;
    }

    return result;
  }, [groups, searchQuery]);

  // Toggle single team selection
  const toggleTeamSelect = (teamId) => {
    if (isReadOnly) return;
    setSelectedTeamIds((prev) => {
      const next = new Set(prev);
      const strId = Number(teamId);
      if (next.has(strId)) next.delete(strId);
      else next.add(strId);
      return next;
    });
  };

  // Toggle select all in a group
  const toggleSelectAllInGroup = (groupId) => {
    if (isReadOnly) return;
    const groupTeams = filteredTeamsByGroup[groupId] || [];
    const allSelected = groupTeams.every((t) => selectedTeamIds.has(Number(t.id)));

    setSelectedTeamIds((prev) => {
      const next = new Set(prev);
      for (const t of groupTeams) {
        if (allSelected) next.delete(Number(t.id));
        else next.add(Number(t.id));
      }
      return next;
    });
  };

  // Toggle group accordion expansion on mobile
  const toggleGroupExpand = (groupId) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // Execute bulk move
  const handleBulkMoveSubmit = (e) => {
    e.preventDefault();
    if (!targetGroupId || selectedTeamIds.size === 0 || isReadOnly) return;

    onBulkMove({
      teamIds: Array.from(selectedTeamIds),
      targetGroupId: Number(targetGroupId),
    });
    setSelectedTeamIds(new Set());
    setTargetGroupId('');
  };

  return (
    <div className="assignment-workspace-container">
      {/* Metric Status Bar */}
      <div className="assignment-status-bar">
        <div className="status-metric-item">
          <span className="metric-label">Round Status</span>
          <span className={`status-badge ${(round?.assignmentStatus || 'DRAFT').toLowerCase()}`}>
            {isLocked ? 'LOCKED' : (round?.assignmentStatus || 'DRAFT')}
          </span>
        </div>
        <div className="status-metric-item">
          <span className="metric-label">Eligible Teams</span>
          <strong className="metric-value">{totalEligible}</strong>
        </div>
        <div className="status-metric-item">
          <span className="metric-label">Assigned</span>
          <strong className="metric-value">{totalAssigned} / {totalEligible}</strong>
        </div>
        <div className="status-metric-item">
          <span className="metric-label">Unassigned</span>
          <strong className={`metric-value ${unassignedTeams.length > 0 ? 'text-warning' : 'text-success'}`}>
            {unassignedTeams.length}
          </strong>
        </div>
        <div className="status-metric-item">
          <span className="metric-label">Duplicates</span>
          <strong className={`metric-value ${duplicateAssignments.length > 0 ? 'text-danger' : 'text-success'}`}>
            {duplicateAssignments.length}
          </strong>
        </div>
      </div>

      {/* Workspace Control Bar */}
      <div className="assignment-controls-bar">
        <div className="search-filter-row">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search team name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="workspace-search-input"
            />
          </div>

          <div className="filter-box">
            <select
              aria-label="Filter groups"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="workspace-select"
            >
              <option value="ALL">All Groups ({groups.length})</option>
              <option value="UNASSIGNED">Unassigned ({unassignedTeams.length})</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.teams?.length || 0} / {g.groupSize})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="primary-actions-row">
          {!isLocked && (
            <button
              className="button secondary-button"
              type="button"
              onClick={() => setShowRegenerateConfirm(true)}
              disabled={isActionLoading || isReadOnly}
            >
              Regenerate Assignment
            </button>
          )}

          {!isLocked ? (
            <button
              className="button primary-button lock-btn"
              type="button"
              onClick={() => setShowLockConfirm(true)}
              disabled={isActionLoading || unassignedTeams.length > 0 || totalAssigned === 0}
            >
              Lock Assignment
            </button>
          ) : (
            <span className="locked-pill-indicator">Assignment Locked</span>
          )}
        </div>
      </div>

      {/* Bulk Movement Action Strip */}
      {!isReadOnly && selectedTeamIds.size > 0 && (
        <form className="bulk-move-strip" onSubmit={handleBulkMoveSubmit}>
          <div className="bulk-selected-count">
            <strong>{selectedTeamIds.size}</strong> teams selected
          </div>
          <div className="bulk-move-controls">
            <label htmlFor="target-group-select" className="visually-hidden">Target group</label>
            <select
              id="target-group-select"
              value={targetGroupId}
              onChange={(e) => setTargetGroupId(e.target.value)}
              required
              className="workspace-select"
            >
              <option value="">Move selected teams to...</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.teams?.length || 0} / {g.groupSize})
                </option>
              ))}
            </select>
            <button
              className="button primary-button"
              type="submit"
              disabled={isActionLoading || !targetGroupId}
            >
              {isActionLoading ? 'Moving...' : 'Move Teams'}
            </button>
            <button
              className="button ghost-button"
              type="button"
              onClick={() => setSelectedTeamIds(new Set())}
            >
              Clear
            </button>
          </div>
        </form>
      )}

      {/* Unassigned Teams Drawer (if any) */}
      {(groupFilter === 'ALL' || groupFilter === 'UNASSIGNED') && unassignedTeams.length > 0 && (
        <div className="unassigned-teams-card">
          <div className="unassigned-header">
            <h3>Unassigned Eligible Teams ({unassignedTeams.length})</h3>
            <small>These teams must be assigned before group locking.</small>
          </div>
          <div className="teams-badge-grid">
            {unassignedTeams.map((team) => (
              <div key={team.id} className="team-roster-pill unassigned-pill">
                <strong>{team.name}</strong>
                <span className="team-pill-id">ID: #{team.id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Groups Grid / Mobile Stack */}
      <div className="groups-workspace-grid">
        {groups
          .filter((g) => groupFilter === 'ALL' || String(g.id) === String(groupFilter))
          .map((group) => {
            const groupTeams = filteredTeamsByGroup[group.id] || [];
            const isGroupExpanded = expandedGroups.has(group.id);
            const isFull = (group.teams?.length || 0) >= group.groupSize;

            return (
              <div
                key={group.id}
                className={`group-panel-card ${isFull ? 'is-full-capacity' : ''}`}
              >
                {/* Group Card Header */}
                <div className="group-panel-header">
                  <div className="group-title-col">
                    <h3 className="group-heading">{group.name}</h3>
                    <span className="group-capacity-tag">
                      {group.teams?.length || 0} / {group.groupSize} Teams
                    </span>
                  </div>

                  <div className="group-header-actions">
                    {!isReadOnly && groupTeams.length > 0 && (
                      <button
                        className="text-button select-all-btn"
                        type="button"
                        onClick={() => toggleSelectAllInGroup(group.id)}
                      >
                        {groupTeams.every((t) => selectedTeamIds.has(Number(t.id)))
                          ? 'Deselect All'
                          : 'Select All'}
                      </button>
                    )}
                    <button
                      className="button ghost-button mobile-toggle-btn"
                      type="button"
                      onClick={() => toggleGroupExpand(group.id)}
                      aria-label="Toggle group roster"
                    >
                      {isGroupExpanded ? 'Close' : 'View'}
                    </button>
                    <Link
                      className="button ghost-button open-group-link"
                      to={`/organizer/tournaments/${tournamentId}/groups/${group.id}`}
                    >
                      Open
                    </Link>
                  </div>
                </div>

                {/* Team Roster in Group */}
                <div className={`group-teams-roster ${isGroupExpanded ? 'is-mobile-expanded' : ''}`}>
                  {groupTeams.length === 0 ? (
                    <p className="empty-roster-text">No teams match search/filter.</p>
                  ) : (
                    <ul className="group-team-list">
                      {groupTeams.map((team, idx) => {
                        const isSelected = selectedTeamIds.has(Number(team.id));

                        return (
                          <li
                            key={team.id}
                            className={`group-team-row ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => toggleTeamSelect(team.id)}
                          >
                            {!isReadOnly && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // Handled by row onClick
                                aria-label={`Select ${team.name}`}
                              />
                            )}
                            <span className="team-seed-number">{idx + 1}.</span>
                            <span className="team-row-name">
                              <strong>{team.name}</strong>
                              <span className="team-row-id">#{team.id}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {/* Confirmation Modal: Lock Assignment */}
      {showLockConfirm && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3>Lock Group Assignment for Round {round?.roundNumber}?</h3>
            <p>
              Once locked, teams cannot be added, removed, moved, or regenerated. Players will be
              notified of their group placement.
            </p>
            <div className="modal-actions">
              <button
                className="button secondary-button"
                type="button"
                onClick={() => setShowLockConfirm(false)}
                disabled={isActionLoading}
              >
                Cancel
              </button>
              <button
                className="button primary-button"
                type="button"
                onClick={() => {
                  setShowLockConfirm(false);
                  onLockAssignment();
                }}
                disabled={isActionLoading}
              >
                Confirm Lock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Regenerate Assignment */}
      {showRegenerateConfirm && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3>Regenerate Group Assignment?</h3>
            <p>
              This will recalculate and overwrite the current draft groups and team placements for
              this round. This cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                className="button secondary-button"
                type="button"
                onClick={() => setShowRegenerateConfirm(false)}
                disabled={isActionLoading}
              >
                Cancel
              </button>
              <button
                className="button danger-button"
                type="button"
                onClick={() => {
                  setShowRegenerateConfirm(false);
                  onRegenerate();
                }}
                disabled={isActionLoading}
              >
                Confirm Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
