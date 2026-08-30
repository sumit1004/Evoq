import { useState } from 'react';
import { LeaderboardTable } from '../../common/LeaderboardTable.jsx';

export function StandingsView({
  round,
  groups = [],
  roundLeaderboard = [],
  tournamentLeaderboard = [],
  isCompleted = false,
  scoringMode = 'KILLS_AND_POSITION',
  groupLeaderboardMap = {}, // { [groupId]: rows[] }
  loading = false,
}) {
  const [selectedDisplay, setSelectedDisplay] = useState(
    isCompleted && tournamentLeaderboard.length > 0 ? 'TOURNAMENT' : 'ALL'
  );

  let currentRows = [];
  let selectedGroupName = '';

  if (selectedDisplay === 'TOURNAMENT') {
    currentRows = tournamentLeaderboard;
    selectedGroupName = 'Official Tournament Final Standings';
  } else if (selectedDisplay === 'ALL') {
    currentRows = roundLeaderboard;
    selectedGroupName = `Round ${round?.roundNumber} Overall Standings`;
  } else {
    currentRows = groupLeaderboardMap[selectedDisplay] || [];
    selectedGroupName = groups.find((g) => String(g.id) === String(selectedDisplay))?.name || 'Group Standings';
  }

  return (
    <div>
      {/* Completed Tournament Podium */}
      {isCompleted && tournamentLeaderboard.length >= 3 && selectedDisplay === 'TOURNAMENT' && (
        <div style={{ background: 'linear-gradient(180deg, rgba(246, 196, 83, 0.1) 0%, rgba(20, 24, 33, 0.4) 100%)', border: '1px solid rgba(246, 196, 83, 0.3)', borderRadius: '8px', padding: '24px 20px', marginBottom: '24px', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#f6c453', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
            OFFICIAL TOURNAMENT CHAMPIONS
          </span>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '22px', fontWeight: 900, color: '#fff' }}>
            Final Tournament Standings
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', alignItems: 'end', maxWidth: '700px', margin: '0 auto' }}>
            {/* 2nd Place */}
            <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', padding: '14px 10px', height: '110px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#e0e0e0', textTransform: 'uppercase' }}>2nd Place</span>
              <strong style={{ fontSize: '14px', color: '#fff', margin: '4px 0' }}>{tournamentLeaderboard[1]?.teamName || tournamentLeaderboard[1]?.team_name}</strong>
              <span style={{ fontSize: '12px', color: '#8b949e' }}>{tournamentLeaderboard[1]?.points ?? 0} pts · {tournamentLeaderboard[1]?.kills ?? 0} kills</span>
            </div>

            {/* 1st Place */}
            <div style={{ background: 'rgba(246, 196, 83, 0.12)', border: '1px solid rgba(246, 196, 83, 0.4)', borderRadius: '6px', padding: '18px 10px', height: '135px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#f6c453', textTransform: 'uppercase' }}>CHAMPION</span>
              <strong style={{ fontSize: '16px', color: '#fff', margin: '4px 0' }}>{tournamentLeaderboard[0]?.teamName || tournamentLeaderboard[0]?.team_name}</strong>
              <span style={{ fontSize: '13px', color: '#f6c453', fontWeight: 700 }}>{tournamentLeaderboard[0]?.points ?? 0} pts · {tournamentLeaderboard[0]?.kills ?? 0} kills</span>
            </div>

            {/* 3rd Place */}
            <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', padding: '14px 10px', height: '95px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#cd7f32', textTransform: 'uppercase' }}>3rd Place</span>
              <strong style={{ fontSize: '14px', color: '#fff', margin: '4px 0' }}>{tournamentLeaderboard[2]?.teamName || tournamentLeaderboard[2]?.team_name}</strong>
              <span style={{ fontSize: '12px', color: '#8b949e' }}>{tournamentLeaderboard[2]?.points ?? 0} pts · {tournamentLeaderboard[2]?.kills ?? 0} kills</span>
            </div>
          </div>
        </div>
      )}

      {/* Top Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff' }}>
            {selectedGroupName}
          </h2>
          <span style={{ fontSize: '12px', color: '#8b949e' }}>
            {selectedDisplay === 'TOURNAMENT'
              ? 'Permanent authoritative historical tournament leaderboard'
              : `Scores calculated across matches in Round ${round?.roundNumber}`}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#8b949e' }}>View:</span>
          <select
            className="comp-select"
            style={{ width: 'auto', minWidth: '200px', padding: '6px 12px', fontSize: '13px' }}
            value={selectedDisplay}
            onChange={(e) => setSelectedDisplay(e.target.value)}
          >
            {tournamentLeaderboard.length > 0 && (
              <option value="TOURNAMENT">
                {isCompleted ? 'Final Tournament Standings' : 'Overall Tournament Standings'} ({tournamentLeaderboard.length} teams)
              </option>
            )}
            <option value="ALL">Round {round?.roundNumber} Overall ({roundLeaderboard.length} teams)</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} Standings
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Leaderboard Table with bounded scroll container */}
      <LeaderboardTable
        rows={currentRows}
        scoringMode={scoringMode}
        loading={loading}
        title=""
        subtitle=""
        emptyMessage={`No match scores recorded yet for ${selectedGroupName}.`}
      />
    </div>
  );
}
