export function GroupCard({
  group,
  onOpenGroup,
  onDeleteGroup,
  isReadOnly = false,
  canDelete = false,
}) {
  const teams = group.teams || [];
  const matches = group.matches || [];
  const completedMatches = matches.filter((m) => m.status === 'COMPLETED').length;
  const roomConfigured = Boolean(group.roomId);
  const statusClass = group.status ? group.status.toLowerCase().replaceAll('_', '-') : 'not-started';

  return (
    <div className="comp-group-card">
      <div>
        <div className="comp-group-card-header">
          <h3 className="comp-group-name">{group.name}</h3>
          <span className={`comp-status-badge comp-status-${statusClass}`}>
            {group.status}
          </span>
        </div>

        <div className="comp-group-meta">
          <div className="comp-meta-row">
            <span>Teams</span>
            <span className="comp-meta-val">
              {teams.length} / {group.groupSize || 12}
            </span>
          </div>

          <div className="comp-meta-row">
            <span>Match Progress</span>
            <span className="comp-meta-val">
              {completedMatches} / {matches.length} Completed
            </span>
          </div>

          <div className="comp-meta-row">
            <span>Room & Lobby</span>
            <span className={`comp-meta-val ${roomConfigured ? 'ready' : 'pending'}`}>
              {roomConfigured ? 'Configured' : 'Not Set'}
            </span>
          </div>
        </div>
      </div>

      <div className="comp-group-card-footer">
        <button
          className="button primary-button"
          type="button"
          style={{ minHeight: '32px', padding: '0 14px', fontSize: '12px' }}
          onClick={() => onOpenGroup(group.id)}
        >
          Open Group →
        </button>

        {!isReadOnly && canDelete && (
          <button
            className="button ghost-button"
            type="button"
            style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px', color: '#ff7b72', borderColor: 'rgba(239, 68, 68, 0.25)' }}
            onClick={() => onDeleteGroup(group)}
            title="Delete Group"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
