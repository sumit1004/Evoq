import { RoomCredentialsCard } from './RoomCredentialsCard.jsx';

export function GroupOverviewView({ group, playerTeam }) {
  if (!group) return null;

  return (
    <div className="group-overview-view">
      {/* Room / Lobby Credentials */}
      <RoomCredentialsCard
        roomId={group.roomId}
        roomPassword={group.roomPassword}
      />

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

