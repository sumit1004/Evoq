import { LeaderboardTable } from '../common/LeaderboardTable.jsx';

export function TournamentLeaderboardView({
  leaderboard = [],
  playerTeam,
  isCompleted = false,
  loading = false,
  error = ''
}) {
  return (
    <div className="tournament-leaderboard-container">
      {/* Completed Tournament Podium */}
      {isCompleted && leaderboard.length >= 3 && (
        <div className="final-podium-card">
          <span className="podium-kicker">OFFICIAL TOURNAMENT CHAMPIONS</span>
          <h2 className="podium-title">Final Tournament Standings</h2>

          <div className="podium-layout">
            {/* 2nd Place */}
            <div className="podium-step step-silver">
              <div className="podium-medal">2nd Place</div>
              <strong className="podium-team-name">{leaderboard[1]?.teamName || leaderboard[1]?.team_name}</strong>
              <span className="podium-stats">
                {leaderboard[1]?.points ?? 0} pts · {leaderboard[1]?.kills ?? 0} kills
              </span>
            </div>

            {/* 1st Place */}
            <div className="podium-step step-gold">
              <div className="podium-medal">CHAMPION</div>
              <strong className="podium-team-name gold-name">{leaderboard[0]?.teamName || leaderboard[0]?.team_name}</strong>
              <span className="podium-stats gold-stats">
                {leaderboard[0]?.points ?? 0} pts · {leaderboard[0]?.kills ?? 0} kills
              </span>
            </div>

            {/* 3rd Place */}
            <div className="podium-step step-bronze">
              <div className="podium-medal">3rd Place</div>
              <strong className="podium-team-name">{leaderboard[2]?.teamName || leaderboard[2]?.team_name}</strong>
              <span className="podium-stats">
                {leaderboard[2]?.points ?? 0} pts · {leaderboard[2]?.kills ?? 0} kills
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Live State Note */}
      {!isCompleted && leaderboard.length > 0 && (
        <div className="live-leaderboard-notice">
          <span>Overall standings aggregated across tournament rounds and matches.</span>
        </div>
      )}

      {/* Standings Table */}
      <LeaderboardTable
        rows={leaderboard}
        playerTeam={playerTeam}
        loading={loading}
        error={error}
        emptyMessage="Leaderboard will appear once match results are published."
      />
    </div>
  );
}
