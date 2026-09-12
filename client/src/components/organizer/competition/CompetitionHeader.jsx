import { Link } from 'react-router-dom';

export function CompetitionHeader({
  tournament,
  activeRound,
  totalGroups = 0,
  totalTeams = 0,
  completedMatches = 0,
  totalMatches = 0,
  liveMatches = 0,
  nextAction,
  onExecuteNextAction,
  isScout = false,
  permissions = new Set(),
  isReadOnly = false,
  onOpenCompleteModal,
  onOpenDeleteModal,
  error = '',
  notice = '',
  onClearNotice,
}) {
  if (!tournament) return null;

  const statusClass = tournament.status ? tournament.status.toLowerCase().replaceAll('_', '-') : 'draft';

  return (
    <header className="comp-header-card">
      <div className="comp-header-top">
        <div>
          <div className="comp-badge-strip">
            <span className={`comp-status-badge comp-status-${statusClass}`}>
              {tournament.status.replaceAll('_', ' ')}
            </span>
            <span className="comp-tag-game">
              {tournament.game || 'Free Fire'}
            </span>
            {activeRound && (
              <span className="comp-tag-round">
                {activeRound.name} · {activeRound.status}
              </span>
            )}
            {isScout && (
              <span className="comp-tag-game" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                SCOUT MODE ({permissions.size} Capabilities)
              </span>
            )}
            {isReadOnly && (
              <span className="comp-status-badge comp-status-completed">
                READ-ONLY ARCHIVE
              </span>
            )}
          </div>

          <h1 className="comp-title">{tournament.name}</h1>
          <p className="comp-desc">
            {tournament.description || 'Esports tournament competition management control center.'}
          </p>
        </div>

        <div className="comp-header-actions">
          <Link
            className="button ghost-button"
            to={`/organizer/tournaments/${tournament.id}`}
            style={{ fontSize: '13px', minHeight: '36px', padding: '0 14px' }}
          >
            Tournament Hub
          </Link>
          <Link
            className="button ghost-button"
            to={`/organizer/tournaments/${tournament.id}/registrations`}
            style={{ fontSize: '13px', minHeight: '36px', padding: '0 14px' }}
          >
            Registrations
          </Link>
          {!isReadOnly && !isScout && tournament.status === 'LIVE' && onOpenCompleteModal && (
            <button
              type="button"
              className="button secondary-button"
              onClick={onOpenCompleteModal}
              style={{ fontSize: '13px', minHeight: '36px', padding: '0 14px', color: '#f6c453', borderColor: 'rgba(246, 196, 83, 0.4)' }}
            >
              Complete Tournament
            </button>
          )}
          {!isScout && onOpenDeleteModal && (
            <button
              type="button"
              className="button ghost-button danger-text"
              onClick={onOpenDeleteModal}
              style={{ fontSize: '13px', minHeight: '36px', padding: '0 14px', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            >
              Delete Tournament
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="comp-metrics-grid">
        <div className="comp-metric-card">
          <span className="comp-metric-label">Active Round</span>
          <span className="comp-metric-value">{activeRound ? activeRound.name : 'None'}</span>
        </div>
        <div className="comp-metric-card">
          <span className="comp-metric-label">Competition Groups</span>
          <span className="comp-metric-value">{totalGroups}</span>
        </div>
        <div className="comp-metric-card">
          <span className="comp-metric-label">Teams In Round</span>
          <span className="comp-metric-value">{totalTeams}</span>
        </div>
        <div className="comp-metric-card">
          <span className="comp-metric-label">Matches Progress</span>
          <span className="comp-metric-value">
            {completedMatches} / {totalMatches}
            {liveMatches > 0 && <span className="comp-metric-sub">({liveMatches} LIVE)</span>}
          </span>
        </div>
      </div>

      {/* Prominent Next Action Banner */}
      {nextAction && nextAction.type !== 'NO_ACTION' && (
        <div className="comp-next-action-card" style={{ marginTop: '20px', marginBottom: 0 }}>
          <div>
            <div className="comp-next-action-title-row">
              <span className="comp-next-action-kicker">Recommended Action</span>
              <h2 className="comp-next-action-title">{nextAction.label}</h2>
            </div>
            <p className="comp-next-action-desc">{nextAction.description}</p>
          </div>
          {onExecuteNextAction && !isReadOnly && (
            <button
              className="button primary-button"
              type="button"
              style={{ minHeight: '36px', padding: '0 18px', fontSize: '13px', whiteSpace: 'nowrap' }}
              onClick={() => onExecuteNextAction(nextAction)}
            >
              {nextAction.label} →
            </button>
          )}
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="comp-alert comp-alert-error" role="alert" style={{ marginTop: '16px', marginBottom: 0 }}>
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="comp-alert comp-alert-success" role="status" style={{ marginTop: '16px', marginBottom: 0 }}>
          <span>{notice}</span>
          {onClearNotice && (
            <button
              type="button"
              onClick={onClearNotice}
              style={{ background: 'none', border: 'none', color: '#2ecc71', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ✕
            </button>
          )}
        </div>
      )}
    </header>
  );
}
