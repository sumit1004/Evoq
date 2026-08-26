import { Link } from 'react-router-dom';

export function PlayerTournamentHeader({
  tournament,
  activeGroup,
  playerTeam,
  currentRoundName,
  connected = true,
  playerGroups = [],
  selectedGroupId,
  setSelectedGroupId,
}) {
  if (!tournament) return null;

  return (
    <div className="player-tournament-hero">
      {/* Contextual Breadcrumb */}
      <div className="player-breadcrumb">
        <Link className="text-link" to="/player/dashboard">Dashboard</Link>
        <span>/</span>
        <Link className="text-link" to="/tournaments">Tournaments</Link>
        <span>/</span>
        <span className="breadcrumb-current">{tournament.name}</span>
      </div>

      {/* Main Esports Hero Card */}
      <div className="hero-card-container">
        <div className="hero-top-row">
          <div className="hero-primary-info">
            {/* Status and Badges Row */}
            <div className="hero-badge-strip">
              <span className={`status-badge ${tournament.status.toLowerCase().replaceAll('_', '-')}`}>
                {tournament.status.replaceAll('_', ' ')}
              </span>
              <span className="hero-tag game-tag">
                {tournament.game || 'Free Fire'}
              </span>
              {currentRoundName && (
                <span className="hero-tag round-tag">
                  {currentRoundName}
                </span>
              )}
              {activeGroup && (
                <span className="hero-tag group-tag">
                  {activeGroup.name}
                </span>
              )}
              {playerTeam && (
                <span className="hero-tag team-tag">
                  ★ {playerTeam.name}
                </span>
              )}
            </div>

            {/* Tournament Title */}
            <h1 className="hero-tournament-title">
              {tournament.name}
            </h1>
            <p className="hero-tournament-desc">
              {tournament.description || 'Official EVOQ tournament match tracking and operations hub.'}
            </p>
          </div>

          {/* Right Side Stats & Live Hub Indicator */}
          <div className="hero-secondary-info">
            <span className={`connection-status ${connected ? 'is-connected' : ''}`}>
              {connected ? '● LIVE REALTIME' : '○ OFFLINE'}
            </span>
            <span className="hero-meta-detail">
              <strong>{tournament.maxTeams} Max Teams</strong>
            </span>
            <span className="hero-entry-detail">
              Entry: {tournament.entryType === 'PAID' ? `₹${tournament.entryFee}` : 'Free Entry'}
            </span>
          </div>
        </div>

        {/* Multi-Group Selector if qualified for multiple rounds */}
        {playerGroups.length > 1 && (
          <div className="hero-groups-selector">
            <span className="selector-label">Your Groups:</span>
            <div className="selector-buttons">
              {playerGroups.map((g) => (
                <button
                  key={g.id}
                  className={selectedGroupId === g.id ? 'button primary-button' : 'button secondary-button'}
                  type="button"
                  onClick={() => setSelectedGroupId(g.id)}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
