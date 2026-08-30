import { useState } from 'react';
import { MatchCard } from './MatchCard.jsx';
import { MatchEditorModal } from './MatchEditorModal.jsx';
import { ScoreEntryModal } from './ScoreEntryModal.jsx';

export function MatchesView({
  round,
  groups = [],
  onSaveMatch,
  onStartMatch,
  onSaveScore,
  onDeleteMatch,
  scoringConfig = {},
  isReadOnly = false,
  canCreateMatches = true,
  canEnterResults = true,
  actionLoading = false,
}) {
  const [filterGroupId, setFilterGroupId] = useState('ALL');
  const [matchModalState, setMatchModalState] = useState({ isOpen: false, match: null, groupId: null });
  const [scoreModalState, setScoreModalState] = useState({ isOpen: false, match: null, group: null, results: [] });
  const [deleteConfirmMatch, setDeleteConfirmMatch] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  // Aggregate matches across all groups or selected group
  const allMatchesWithGroup = groups.flatMap((grp) =>
    (grp.matches || []).map((m) => ({
      ...m,
      groupId: grp.id,
      groupName: grp.name,
      teams: grp.teams || [],
    }))
  );

  const displayedMatches =
    filterGroupId === 'ALL'
      ? allMatchesWithGroup
      : allMatchesWithGroup.filter((m) => String(m.groupId) === String(filterGroupId));

  const handleOpenScore = (match) => {
    const grp = groups.find((g) => g.id === match.groupId);
    setScoreModalState({
      isOpen: true,
      match,
      group: grp,
      results: match.results || [],
    });
  };

  const handleOpenEdit = (match) => {
    setMatchModalState({
      isOpen: true,
      match,
      groupId: match.groupId,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmMatch) return;
    setDeleteError('');
    try {
      await onDeleteMatch(deleteConfirmMatch.id);
      setDeleteConfirmMatch(null);
    } catch (e) {
      setDeleteError(e.message || 'Failed to delete match.');
    }
  };

  return (
    <div>
      {/* Top Controls: Filter & Create Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff' }}>
            Round Matches ({displayedMatches.length})
          </h2>

          {groups.length > 1 && (
            <select
              className="comp-select"
              style={{ width: 'auto', minWidth: '160px', padding: '6px 12px', fontSize: '13px' }}
              value={filterGroupId}
              onChange={(e) => setFilterGroupId(e.target.value)}
            >
              <option value="ALL">All Groups ({allMatchesWithGroup.length} matches)</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({(g.matches || []).length} matches)
                </option>
              ))}
            </select>
          )}
        </div>

        {!isReadOnly && canCreateMatches && groups.length > 0 && (
          <button
            className="button primary-button"
            type="button"
            style={{ minHeight: '34px', padding: '0 14px', fontSize: '13px' }}
            onClick={() => setMatchModalState({ isOpen: true, match: null, groupId: groups[0]?.id })}
          >
            + Create Match
          </button>
        )}
      </div>

      {/* Empty State */}
      {displayedMatches.length === 0 ? (
        <div className="comp-empty-state">
          <h3 className="comp-empty-state-title">No matches found</h3>
          <p className="comp-empty-state-desc">
            {groups.length === 0
              ? 'Create groups first before scheduling matches.'
              : 'Schedule matches for groups in this round to begin competition.'}
          </p>
          {!isReadOnly && canCreateMatches && groups.length > 0 && (
            <button
              className="button primary-button"
              type="button"
              onClick={() => setMatchModalState({ isOpen: true, match: null, groupId: groups[0]?.id })}
            >
              + Create Match
            </button>
          )}
        </div>
      ) : (
        /* Matches Grid */
        <div className="comp-matches-grid">
          {displayedMatches.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              groupName={m.groupName}
              onOpenScore={handleOpenScore}
              onEditMatch={handleOpenEdit}
              onStartMatch={onStartMatch}
              onDeleteMatch={(match) => setDeleteConfirmMatch(match)}
              isReadOnly={isReadOnly}
              canEnterResults={canEnterResults}
              canManageMatches={canCreateMatches}
            />
          ))}
        </div>
      )}

      {/* Match Create / Edit Modal */}
      <MatchEditorModal
        isOpen={matchModalState.isOpen}
        onClose={() => setMatchModalState({ isOpen: false, match: null, groupId: null })}
        initialGroupId={matchModalState.groupId}
        groups={groups}
        match={matchModalState.match}
        onSaveMatch={async (grpId, payload, matchId) => {
          await onSaveMatch(grpId, payload, matchId);
          setMatchModalState({ isOpen: false, match: null, groupId: null });
        }}
        loading={actionLoading}
      />

      {/* Score Entry Modal */}
      <ScoreEntryModal
        isOpen={scoreModalState.isOpen}
        onClose={() => setScoreModalState({ isOpen: false, match: null, group: null, results: [] })}
        match={scoreModalState.match}
        teams={scoreModalState.group?.teams || []}
        scoringConfig={scoringConfig}
        existingResults={scoreModalState.results}
        onSaveScore={async (matchId, payload) => {
          const res = await onSaveScore(matchId, payload);
          // Update modal results list with newly saved result
          setScoreModalState((prev) => ({
            ...prev,
            results: [...prev.results.filter((r) => r.teamId !== payload.teamId), res],
          }));
        }}
        loading={actionLoading}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmMatch && (
        <div className="comp-modal-overlay" role="dialog" aria-modal="true">
          <div className="comp-modal" style={{ maxWidth: '440px' }}>
            <div className="comp-modal-header">
              <h2 className="comp-modal-title">Delete Match?</h2>
              <button className="comp-modal-close" onClick={() => { setDeleteConfirmMatch(null); setDeleteError(''); }} type="button">
                ✕
              </button>
            </div>
            {deleteError && (
              <div className="comp-alert comp-alert-error" style={{ marginBottom: '12px' }}>
                {deleteError}
              </div>
            )}
            <p style={{ fontSize: '13px', color: '#8b949e', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong style={{ color: '#fff' }}>{deleteConfirmMatch.name}</strong>?
              Matches with finalized scores cannot be deleted.
            </p>
            <div className="comp-modal-footer">
              <button className="button secondary-button" type="button" onClick={() => { setDeleteConfirmMatch(null); setDeleteError(''); }}>
                Cancel
              </button>
              <button
                className="button ghost-button"
                type="button"
                style={{ color: '#ff7b72', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                disabled={actionLoading}
                onClick={handleConfirmDelete}
              >
                {actionLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
