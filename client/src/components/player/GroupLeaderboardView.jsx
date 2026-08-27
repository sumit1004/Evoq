import { LeaderboardTable } from '../common/LeaderboardTable.jsx';

export function GroupLeaderboardView({ leaderboard = [], playerTeam, loading = false, error = '' }) {
  return (
    <div className="group-leaderboard-container">
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
