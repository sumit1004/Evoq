export function RoundSelector({
  rounds = [],
  selectedRoundId,
  onSelectRound,
  onCreateRoundClick,
  onStartRound,
  onCompleteRound,
  onDeleteRound,
  isReadOnly = false,
  canCreateRound = true,
  canManageRound = true,
}) {
  const selectedRound = rounds.find((r) => r.id === selectedRoundId);

  return (
    <div className="comp-round-nav">
      <div className="comp-round-tabs" role="tablist" aria-label="Competition Rounds">
        {rounds.map((round) => {
          const isSelected = round.id === selectedRoundId;
          const statusClass = round.status ? round.status.toLowerCase().replaceAll('_', '-') : 'not-started';
          const groupCount = round.groups?.length ?? round.stats?.totalGroups ?? 0;
          const matchCount = round.stats?.totalMatches ?? 0;

          return (
            <button
              key={round.id}
              role="tab"
              aria-selected={isSelected}
              className={`comp-round-tab ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectRound(round.id)}
              type="button"
            >
              <span>{round.name || `Round ${round.roundNumber}`}</span>
              <span className={`comp-round-badge comp-status-${statusClass}`}>
                {round.status}
              </span>
              <span className="comp-round-badge">
                {groupCount}G · {matchCount}M
              </span>
            </button>
          );
        })}

        {!isReadOnly && canCreateRound && (
          <button
            className="button secondary-button"
            type="button"
            style={{ minHeight: '34px', padding: '0 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
            onClick={onCreateRoundClick}
          >
            + Create Round
          </button>
        )}
      </div>

      {selectedRound && !isReadOnly && canManageRound && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {selectedRound.status === 'NOT_STARTED' && (
            <button
              className="button primary-button"
              type="button"
              style={{ minHeight: '32px', padding: '0 12px', fontSize: '12px' }}
              onClick={() => onStartRound(selectedRound.id)}
            >
              Start Round
            </button>
          )}
          {selectedRound.status === 'IN_PROGRESS' && (
            <button
              className="button secondary-button"
              type="button"
              style={{ minHeight: '32px', padding: '0 12px', fontSize: '12px', color: '#f6c453', borderColor: 'rgba(246, 196, 83, 0.4)' }}
              onClick={() => onCompleteRound(selectedRound.id)}
            >
              Complete Round
            </button>
          )}
          {onDeleteRound && selectedRound.status !== 'COMPLETED' && (
            <button
              className="button ghost-button danger-text"
              type="button"
              style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              onClick={() => onDeleteRound(selectedRound.id)}
            >
              Delete Round
            </button>
          )}
        </div>
      )}
    </div>
  );
}
