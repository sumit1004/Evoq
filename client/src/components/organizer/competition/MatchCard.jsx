export function MatchCard({
  match,
  groupName,
  onOpenScore,
  onEditMatch,
  onStartMatch,
  onDeleteMatch,
  isReadOnly = false,
  canEnterResults = true,
  canManageMatches = true,
}) {
  const statusClass = match.status ? match.status.toLowerCase().replaceAll('_', '-') : 'scheduled';
  const scheduledTime = match.scheduledAt
    ? new Date(match.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'TBD';

  return (
    <div className="comp-match-card">
      <div>
        <div className="comp-match-header">
          <div>
            <h4 className="comp-match-title">{match.name || `Match ${match.matchNumber}`}</h4>
            {groupName && (
              <span style={{ fontSize: '11px', color: '#7dd3fc', fontWeight: 600 }}>
                {groupName}
              </span>
            )}
          </div>
          <span className={`comp-status-badge comp-status-${statusClass}`}>
            {match.status}
          </span>
        </div>

        <div className="comp-match-body">
          <div className="comp-meta-row">
            <span>Scheduled Time</span>
            <span className="comp-meta-val">{scheduledTime}</span>
          </div>

          <div className="comp-meta-row">
            <span>Room ID</span>
            <span className={`comp-meta-val ${match.roomId ? 'ready' : ''}`}>
              {match.roomId || 'Not set'}
            </span>
          </div>

          <div className="comp-meta-row">
            <span>Password</span>
            <span className="comp-meta-val">
              {match.roomPassword || 'None'}
            </span>
          </div>
        </div>
      </div>

      <div className="comp-match-footer">
        {!isReadOnly && canEnterResults && match.status !== 'COMPLETED' && (
          <button
            className="button primary-button"
            type="button"
            style={{ minHeight: '30px', padding: '0 12px', fontSize: '12px' }}
            onClick={() => onOpenScore(match)}
          >
            Manage Score
          </button>
        )}

        {match.status === 'SCHEDULED' && !isReadOnly && canManageMatches && (
          <button
            className="button secondary-button"
            type="button"
            style={{ minHeight: '30px', padding: '0 10px', fontSize: '12px' }}
            onClick={() => onStartMatch(match.id)}
          >
            Start Match
          </button>
        )}

        {!isReadOnly && canManageMatches && (
          <button
            className="button ghost-button"
            type="button"
            style={{ minHeight: '30px', padding: '0 8px', fontSize: '12px' }}
            onClick={() => onEditMatch(match)}
          >
            Edit
          </button>
        )}

        {!isReadOnly && canManageMatches && (
          <button
            className="button ghost-button"
            type="button"
            style={{ minHeight: '30px', padding: '0 8px', fontSize: '12px', color: '#ff7b72' }}
            onClick={() => onDeleteMatch(match)}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
