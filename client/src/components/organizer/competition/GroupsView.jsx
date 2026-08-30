import { useState } from 'react';
import { GroupCard } from './GroupCard.jsx';
import { GroupAssignmentModal } from './GroupAssignmentModal.jsx';
import { TeamMoveModal } from './TeamMoveModal.jsx';
import { InlineGroupWorkspace } from './InlineGroupWorkspace.jsx';

export function GroupsView({
  round,
  groups = [],
  eligibleTeams = [],
  selectedGroupId,
  onSelectGroup,
  activeGroupTab = 'overview',
  onSelectGroupTab,
  onBackToGroups,
  onAutoAssign,
  onMoveTeamConfirm,
  onRemoveTeam,
  onUpdateGroupRoom,
  onStartMatch,
  onOpenScoreModal,
  onOpenMatchModal,
  onDeleteMatch,
  onDeleteGroup,
  onCompleteGroup,
  groupLeaderboard = [],
  scoringMode = 'KILLS_AND_POSITION',
  isReadOnly = false,
  canCreateGroups = true,
  canAssignTeams = true,
  canManageRoom = true,
  canManageMatches = true,
  canDelete = true,
  actionLoading = false,
}) {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [moveTeamState, setMoveTeamState] = useState({ isOpen: false, team: null, group: null });

  const activeGroup = groups.find((g) => g.id === selectedGroupId);

  const handleOpenMoveTeam = (team, group) => {
    setMoveTeamState({ isOpen: true, team, group });
  };

  const handleConfirmMove = async (teamId, targetGroupId) => {
    try {
      await onMoveTeamConfirm(teamId, targetGroupId);
      setMoveTeamState({ isOpen: false, team: null, group: null });
    } catch (e) {
      // Error handled by parent
    }
  };

  // If a group is currently selected, show the InlineGroupWorkspace
  if (activeGroup) {
    return (
      <>
        <InlineGroupWorkspace
          group={activeGroup}
          round={round}
          activeTab={activeGroupTab}
          onSelectTab={onSelectGroupTab}
          onBackToGroups={onBackToGroups}
          onUpdateRoom={onUpdateGroupRoom}
          onStartMatch={onStartMatch}
          onOpenScoreModal={onOpenScoreModal}
          onOpenMatchModal={onOpenMatchModal}
          onDeleteMatch={onDeleteMatch}
          onMoveTeam={handleOpenMoveTeam}
          onRemoveTeam={onRemoveTeam}
          onCompleteGroup={onCompleteGroup}
          isReadOnly={isReadOnly}
          canManageRoom={canManageRoom}
          canManageMatches={canManageMatches}
          canAssignTeams={canAssignTeams}
          leaderboardRows={groupLeaderboard}
          scoringMode={scoringMode}
          loading={actionLoading}
        />

        <TeamMoveModal
          isOpen={moveTeamState.isOpen}
          onClose={() => setMoveTeamState({ isOpen: false, team: null, group: null })}
          team={moveTeamState.team}
          currentGroup={moveTeamState.group}
          availableGroups={groups}
          onConfirmMove={handleConfirmMove}
          loading={actionLoading}
        />
      </>
    );
  }

  return (
    <div>
      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff' }}>
            Round Groups ({groups.length})
          </h2>
          <span style={{ fontSize: '12px', color: '#8b949e' }}>
            {eligibleTeams.length} eligible teams available for Round {round?.roundNumber}
          </span>
        </div>

        {!isReadOnly && canCreateGroups && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="button primary-button"
              type="button"
              style={{ minHeight: '34px', padding: '0 14px', fontSize: '13px' }}
              onClick={() => setShowAssignModal(true)}
              disabled={actionLoading || (groups.length > 0 && (round?.status === 'IN_PROGRESS' || round?.status === 'COMPLETED'))}
              title={groups.length > 0 && (round?.status === 'IN_PROGRESS' || round?.status === 'COMPLETED') ? 'Groups cannot be regenerated while round is active or completed. Use manual team actions.' : ''}
            >
              + Create Groups Workflow
            </button>
          </div>
        )}
      </div>

      {/* Empty State */}
      {groups.length === 0 ? (
        <div className="comp-empty-state">
          <h3 className="comp-empty-state-title">No groups created for this round yet</h3>
          <p className="comp-empty-state-desc">
            Use the balanced group creation wizard to automatically distribute verified teams into competition groups.
          </p>
          {!isReadOnly && canCreateGroups && (
            <button
              className="button primary-button"
              type="button"
              onClick={() => setShowAssignModal(true)}
            >
              Start Group Creation Wizard →
            </button>
          )}
        </div>
      ) : (
        /* Grid of Group Cards */
        <div className="comp-group-grid">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onOpenGroup={onSelectGroup}
              onDeleteGroup={onDeleteGroup}
              isReadOnly={isReadOnly}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <GroupAssignmentModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        round={round}
        eligibleTeams={eligibleTeams}
        onConfirmAssignment={async (config) => {
          await onAutoAssign(config);
          setShowAssignModal(false);
        }}
        loading={actionLoading}
      />
    </div>
  );
}
