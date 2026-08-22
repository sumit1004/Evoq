import { RoomCredentialsCard } from './RoomCredentialsCard.jsx';

export function GroupOverviewView({ group, playerTeam, onNavigate }) {
  if (!group) return null;

  return (
    <div className="group-overview-view">
      {/* Room / Lobby Credentials */}
      <RoomCredentialsCard
        roomId={group.roomId}
        roomPassword={group.roomPassword}
      />

      {/* Quick Navigation Cards */}
      <div className="group-quick-links">
        <button
          className="group-quick-card"
          type="button"
          onClick={() => onNavigate('matches')}
        >
          <span className="quick-icon">🎮</span>
          <div>
            <strong>Group Matches</strong>
            <span>View match cards and live scores</span>
          </div>
          <span className="arrow-icon">→</span>
        </button>

        <button
          className="group-quick-card"
          type="button"
          onClick={() => onNavigate('leaderboard')}
        >
          <span className="quick-icon">🏆</span>
          <div>
            <strong>Group Standings</strong>
            <span>Check points and kill leaderboards</span>
          </div>
          <span className="arrow-icon">→</span>
        </button>

        <button
          className="group-quick-card"
          type="button"
          onClick={() => onNavigate('chat')}
        >
          <span className="quick-icon">💬</span>
          <div>
            <strong>Group Team Chat</strong>
            <span>Coordinate with group members</span>
          </div>
          <span className="arrow-icon">→</span>
        </button>
      </div>

      {/* Assigned Teams Section */}
      <div className="assigned-teams-panel">
        <div className="panel-header-row">
          <h3>Assigned Teams ({group.teams?.length || 0} / {group.groupSize || 12})</h3>
          <span className="panel-meta-tag">Group: {group.name}</span>
        </div>

        {!group.teams?.length ? (
          <p className="empty-state">No teams assigned to this group yet.</p>
        ) : (
          <div className="teams-badge-grid">
            {group.teams.map((team) => {
              const isMyTeam = playerTeam && (playerTeam.id === team.id || playerTeam.name === team.name);

              return (
                <div
                  key={team.id}
                  className={`team-roster-pill ${isMyTeam ? 'is-my-team-pill' : ''}`}
                >
                  <div className="team-pill-name-row">
                    <span className="team-dot" />
                    <strong>{team.name}</strong>
                  </div>
                  {isMyTeam ? (
                    <span className="my-team-badge">YOUR TEAM</span>
                  ) : (
                    <span className="team-confirmed-label">Assigned</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
