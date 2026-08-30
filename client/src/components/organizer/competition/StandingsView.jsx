import { useState } from 'react';
import { LeaderboardTable } from '../../common/LeaderboardTable.jsx';

export function StandingsView({
  round,
  groups = [],
  roundLeaderboard = [],
  scoringMode = 'KILLS_AND_POSITION',
  groupLeaderboardMap = {}, // { [groupId]: rows[] }
  loading = false,
}) {
  const [selectedDisplay, setSelectedDisplay] = useState('ALL'); // 'ALL' for round overall or groupId

  const currentRows =
    selectedDisplay === 'ALL'
      ? roundLeaderboard
      : groupLeaderboardMap[selectedDisplay] || [];

  const selectedGroupName =
    selectedDisplay === 'ALL'
      ? `Round ${round?.roundNumber} Overall Standings`
      : groups.find((g) => String(g.id) === String(selectedDisplay))?.name || 'Group Standings';

  return (
    <div>
      {/* Top Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff' }}>
            {selectedGroupName}
          </h2>
          <span style={{ fontSize: '12px', color: '#8b949e' }}>
            Scores calculated across matches in Round {round?.roundNumber}
          </span>
        </div>

        {groups.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#8b949e' }}>View:</span>
            <select
              className="comp-select"
              style={{ width: 'auto', minWidth: '180px', padding: '6px 12px', fontSize: '13px' }}
              value={selectedDisplay}
              onChange={(e) => setSelectedDisplay(e.target.value)}
            >
              <option value="ALL">Round {round?.roundNumber} Overall ({roundLeaderboard.length} teams)</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} Standings
                </option>
              ))}
            </select>
          </div>
        )}
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
