export function LeaderboardTable({
  rows = [],
  playerTeam = null,
  currentTeamId = null,
  scoringMode = 'KILLS_AND_POSITION',
  loading = false,
  error = '',
  onRetry = null,
  emptyMessage = 'No standings available yet.',
  title = '',
  subtitle = ''
}) {
  const isTotalScoreMode = scoringMode === 'TOTAL_SCORE';

  if (loading) {
    return (
      <div className="leaderboard-table-wrapper">
        {title && (
          <div className="leaderboard-header-strip">
            <div>
              <h3 className="leaderboard-title">{title}</h3>
              {subtitle && <p className="leaderboard-subtitle">{subtitle}</p>}
            </div>
          </div>
        )}
        <div className="table-responsive-box">
          <div className="leaderboard-skeleton-box" aria-hidden="true">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="leaderboard-skeleton-row">
                <span className="sk-rank" />
                <span className="sk-team" />
                {!isTotalScoreMode && <span className="sk-kills" />}
                {!isTotalScoreMode && <span className="sk-pos" />}
                <span className="sk-pts" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="leaderboard-table-wrapper">
        <div className="leaderboard-error-panel" role="alert">
          <p>{error || 'Unable to load leaderboard.'}</p>
          {onRetry && (
            <button className="button secondary-button" type="button" onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="leaderboard-table-wrapper">
        {title && (
          <div className="leaderboard-header-strip">
            <div>
              <h3 className="leaderboard-title">{title}</h3>
              {subtitle && <p className="leaderboard-subtitle">{subtitle}</p>}
            </div>
          </div>
        )}
        <div className="leaderboard-empty-panel">
          <p className="empty-state">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  const isMyTeamRow = (row) => {
    if (currentTeamId && (row.teamId === currentTeamId || row.team_id === currentTeamId)) return true;
    if (playerTeam) {
      if (playerTeam.id && (row.teamId === playerTeam.id || row.team_id === playerTeam.id)) return true;
      if (playerTeam.name && (row.teamName === playerTeam.name || row.team_name === playerTeam.name)) return true;
    }
    return false;
  };

  return (
    <div className="leaderboard-table-wrapper">
      {title && (
        <div className="leaderboard-header-strip">
          <div>
            <h3 className="leaderboard-title">{title}</h3>
            {subtitle && <p className="leaderboard-subtitle">{subtitle}</p>}
          </div>
        </div>
      )}

      <div className="table-responsive-box">
        <table className="esports-table leaderboard-table">
          <thead>
            <tr>
              <th className="th-rank">RANK</th>
              <th className="th-team">TEAM</th>
              {!isTotalScoreMode && <th className="th-kills">KILLS</th>}
              {!isTotalScoreMode && <th className="th-position">POSITION</th>}
              <th className="th-points">TOTAL POINTS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const rankNum = row.rank || index + 1;
              const isMyTeam = isMyTeamRow(row);
              const pos = row.position !== null && row.position !== undefined
                ? row.position
                : (row.placement !== null && row.placement !== undefined ? row.placement : '-');

              return (
                <tr
                  key={`${row.teamId || row.team_id || index}-${index}`}
                  className={`leaderboard-row ${isMyTeam ? 'is-my-team-row' : ''} ${rankNum <= 3 ? `top-rank rank-${rankNum}` : ''}`}
                >
                  <td className="rank-cell">
                    <span className={`rank-badge rank-${rankNum <= 3 ? rankNum : 'other'}`}>
                      #{rankNum}
                    </span>
                  </td>
                  <td className="team-cell">
                    <div className="team-name-wrapper">
                      <strong className="team-name-text">{row.teamName || row.team_name}</strong>
                      {isMyTeam && <span className="my-team-pill">YOUR TEAM</span>}
                    </div>
                  </td>
                  {!isTotalScoreMode && <td className="kills-cell">{row.kills ?? 0}</td>}
                  {!isTotalScoreMode && <td className="position-cell">{pos}</td>}
                  <td className="points-cell">
                    <strong className="points-value">{row.points ?? 0}</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
