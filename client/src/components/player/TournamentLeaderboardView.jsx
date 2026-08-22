export function TournamentLeaderboardView({
  leaderboard = [],
  playerTeam,
  isCompleted = false,
}) {
  return (
    <div className="tournament-leaderboard-container">
      {/* Completed Tournament Podium */}
      {isCompleted && leaderboard.length >= 3 && (
        <div className="final-podium-card">
          <span className="podium-kicker">🏆 OFFICIAL TOURNAMENT CHAMPIONS</span>
          <h2 className="podium-title">Final Tournament Standings</h2>

          <div className="podium-layout">
            {/* 2nd Place */}
            <div className="podium-step step-silver">
              <div className="podium-medal">🥈 2nd Place</div>
              <strong className="podium-team-name">{leaderboard[1].teamName}</strong>
              <span className="podium-stats">
                {leaderboard[1].points} pts · {leaderboard[1].kills} kills
              </span>
            </div>

            {/* 1st Place */}
            <div className="podium-step step-gold">
              <div className="podium-medal">👑 CHAMPION</div>
              <strong className="podium-team-name gold-name">{leaderboard[0].teamName}</strong>
              <span className="podium-stats gold-stats">
                {leaderboard[0].points} pts · {leaderboard[0].kills} kills
              </span>
            </div>

            {/* 3rd Place */}
            <div className="podium-step step-bronze">
              <div className="podium-medal">🥉 3rd Place</div>
              <strong className="podium-team-name">{leaderboard[2].teamName}</strong>
              <span className="podium-stats">
                {leaderboard[2].points} pts · {leaderboard[2].kills} kills
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Live State Note */}
      {!isCompleted && leaderboard.length > 0 && (
        <div className="live-leaderboard-notice">
          <span>ℹ️ Final standings will appear when the tournament is completed.</span>
        </div>
      )}

      {/* Standings Table */}
      {!leaderboard.length ? (
        <div className="leaderboard-empty-panel">
          <p className="empty-state">
            Leaderboard will appear once match results are published.
          </p>
        </div>
      ) : (
        <div className="table-responsive-box">
          <table className="esports-table leaderboard-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Rank</th>
                <th>Team</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Kills</th>
                <th style={{ width: '120px', textAlign: 'right' }}>Total Points</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row, index) => {
                const rank = row.rank || index + 1;
                const isMyTeam = playerTeam && (playerTeam.id === row.teamId || playerTeam.name === row.teamName);

                return (
                  <tr
                    key={`${row.teamId}-${index}`}
                    className={`leaderboard-row ${isMyTeam ? 'is-my-team-row' : ''}`}
                  >
                    <td className="rank-cell">
                      <span className={`rank-badge rank-${rank <= 3 ? rank : 'other'}`}>
                        #{rank}
                      </span>
                    </td>
                    <td className="team-cell">
                      <div className="team-name-wrapper">
                        <strong>{row.teamName}</strong>
                        {isMyTeam && (
                          <span className="my-team-pill">YOUR TEAM</span>
                        )}
                      </div>
                    </td>
                    <td className="kills-cell" style={{ textAlign: 'center' }}>
                      {row.kills}
                    </td>
                    <td className="points-cell" style={{ textAlign: 'right' }}>
                      <strong>{row.points}</strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
