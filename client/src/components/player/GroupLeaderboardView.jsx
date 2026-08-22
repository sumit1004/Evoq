export function GroupLeaderboardView({ leaderboard = [], playerTeam }) {
  if (!leaderboard.length) {
    return (
      <div className="leaderboard-empty-panel">
        <p className="empty-state">
          Leaderboard will appear once match results are published.
        </p>
      </div>
    );
  }

  return (
    <div className="group-leaderboard-container">
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
    </div>
  );
}
