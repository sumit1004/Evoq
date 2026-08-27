import { useState } from 'react';

export function GroupMatchesView({
  matches = [],
  activeGroup = null,
  playerTeam,
  expandedMatchResults = {},
  matchResultsData = {},
  onToggleMatchResult,
}) {
  const [copiedField, setCopiedField] = useState(null);

  const handleCopy = (text, fieldKey) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  if (!matches.length) {
    return (
      <div className="matches-empty-panel">
        <p className="empty-state">
          Your next match has not been scheduled yet.
        </p>
      </div>
    );
  }

  return (
    <div className="group-matches-container">
      {matches.map((match) => {
        const isExpanded = expandedMatchResults[match.id];
        const results = matchResultsData[match.id] || [];
        const isLive = match.status === 'LIVE';
        const effectiveRoomId = match.roomId || activeGroup?.roomId;
        const effectiveRoomPassword = match.roomPassword || activeGroup?.roomPassword;

        return (
          <div
            key={match.id}
            className={`match-card-item ${isLive ? 'is-live-match-card' : ''}`}
          >
            <div className="match-card-main">
              <div className="match-card-info">
                <div className="match-meta-strip">
                  <span className="match-num-label">Match #{match.matchNumber}</span>
                  <span className={`status-badge ${match.status.toLowerCase()}`}>
                    {match.status}
                  </span>
                </div>
                <h4 className="match-title">{match.name}</h4>
                <span className="match-time-label">
                  {match.scheduledAt
                    ? new Date(match.scheduledAt).toLocaleString()
                    : 'Schedule pending'}
                </span>

                {/* Match Room ID & Room Password Credentials Strip */}
                {(effectiveRoomId || effectiveRoomPassword) && (
                  <div
                    className="match-room-mini-strip"
                    style={{
                      marginTop: '12px',
                      display: 'flex',
                      gap: '16px',
                      flexWrap: 'wrap',
                      background: 'rgba(255, 255, 255, 0.03)',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <div className="mini-credential-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="mini-label" style={{ fontSize: '12px', color: '#91a0b3' }}>Room ID:</span>
                      <strong className="mini-value" style={{ color: effectiveRoomId ? '#2ecc71' : '#64748b', fontSize: '13px' }}>
                        {effectiveRoomId || 'Pending'}
                      </strong>
                      {effectiveRoomId && (
                        <button
                          className="button secondary-button mini-copy-btn"
                          type="button"
                          style={{ minHeight: '26px', padding: '0 8px', fontSize: '11px' }}
                          onClick={() => handleCopy(effectiveRoomId, `roomId-${match.id}`)}
                        >
                          {copiedField === `roomId-${match.id}` ? '✓ Copied' : 'Copy'}
                        </button>
                      )}
                    </div>
                    <div className="mini-credential-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="mini-label" style={{ fontSize: '12px', color: '#91a0b3' }}>Password:</span>
                      <strong className="mini-value password-text" style={{ color: effectiveRoomPassword ? '#f6c453' : '#64748b', fontSize: '13px' }}>
                        {effectiveRoomPassword || 'Pending'}
                      </strong>
                      {effectiveRoomPassword && (
                        <button
                          className="button secondary-button mini-copy-btn"
                          type="button"
                          style={{ minHeight: '26px', padding: '0 8px', fontSize: '11px' }}
                          onClick={() => handleCopy(effectiveRoomPassword, `roomPass-${match.id}`)}
                        >
                          {copiedField === `roomPass-${match.id}` ? '✓ Copied' : 'Copy'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="match-card-action">
                {match.status === 'COMPLETED' ? (
                  <button
                    className="button secondary-button scoreboard-toggle-btn"
                    type="button"
                    onClick={() => onToggleMatchResult(match.id)}
                  >
                    {isExpanded ? 'Hide Results ▲' : 'View Results ▼'}
                  </button>
                ) : match.status === 'LIVE' ? (
                  <span className="live-pulsing-tag">● LIVE IN PROGRESS</span>
                ) : (
                  <span className="upcoming-tag">Scheduled</span>
                )}
              </div>
            </div>

            {/* Expandable Match Scoreboard Table */}
            {isExpanded && (
              <div className="match-scoreboard-panel">
                <h5 className="scoreboard-heading">Match Scoreboard & Results</h5>
                {results.length === 0 ? (
                  <p className="empty-state">Loading match scores...</p>
                ) : (
                  <div className="responsive-table-wrapper">
                    <table className="esports-table">
                      <thead>
                        <tr>
                          <th>Placement</th>
                          <th>Team</th>
                          <th>Kills</th>
                          <th>Total Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((res, i) => {
                          const isMyTeam = playerTeam && (playerTeam.id === res.teamId || playerTeam.name === res.teamName);

                          return (
                            <tr
                              key={res.teamId || i}
                              className={isMyTeam ? 'is-my-team-row' : ''}
                            >
                              <td className="rank-cell">
                                #{res.placement || i + 1}
                              </td>
                              <td className="team-cell">
                                <strong>{res.teamName}</strong>
                                {isMyTeam && <span className="inline-team-tag">YOU</span>}
                              </td>
                              <td className="kills-cell">{res.kills}</td>
                              <td className="points-cell">{res.points}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
