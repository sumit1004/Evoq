import { useState } from 'react';

export function CurrentMatchCard({ match, activeGroup, onOpenMatchDetails }) {
  const [copiedField, setCopiedField] = useState(null);

  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const isLive = match?.status === 'LIVE';

  return (
    <div className={`current-match-card ${isLive ? 'is-live-match' : ''}`}>
      <div className="current-match-header">
        <div className="current-match-kicker">
          {isLive ? '🔴 LIVE MATCH IN PROGRESS' : 'NEXT SCHEDULED MATCH'}
        </div>
        {match && (
          <span className={`status-badge ${match.status.toLowerCase()}`}>
            {match.status}
          </span>
        )}
      </div>

      {match ? (
        <div className="current-match-content">
          <div className="match-identity">
            <h3 className="match-title">
              {match.name || `Match #${match.matchNumber}`}
            </h3>
            <span className="match-meta">
              {activeGroup ? activeGroup.name : 'Assigned Group'} · {match.scheduledAt ? new Date(match.scheduledAt).toLocaleString() : 'Ready to start'}
            </span>
          </div>

          {/* Quick Room Mini Strip if available */}
          {activeGroup && (activeGroup.roomId || activeGroup.roomPassword) && (
            <div className="match-room-mini-strip">
              <div className="mini-credential-item">
                <span className="mini-label">Room ID:</span>
                <strong className="mini-value">{activeGroup.roomId || 'Pending'}</strong>
                {activeGroup.roomId && (
                  <button
                    className="button secondary-button mini-copy-btn"
                    type="button"
                    onClick={() => handleCopy(activeGroup.roomId, 'roomId')}
                  >
                    {copiedField === 'roomId' ? '✓' : 'Copy'}
                  </button>
                )}
              </div>
              <div className="mini-credential-item">
                <span className="mini-label">Password:</span>
                <strong className="mini-value password-text">{activeGroup.roomPassword || 'Pending'}</strong>
                {activeGroup.roomPassword && (
                  <button
                    className="button secondary-button mini-copy-btn"
                    type="button"
                    onClick={() => handleCopy(activeGroup.roomPassword, 'roomPass')}
                  >
                    {copiedField === 'roomPass' ? '✓' : 'Copy'}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="match-action-column">
            <button
              className="button primary-button open-match-btn"
              type="button"
              onClick={onOpenMatchDetails}
            >
              Open Match Details →
            </button>
          </div>
        </div>
      ) : (
        <div className="no-match-empty-box">
          <p className="empty-state">
            No upcoming match has been scheduled yet for your group.
          </p>
        </div>
      )}
    </div>
  );
}
