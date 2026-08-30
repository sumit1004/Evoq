import { useState, useEffect } from 'react';

export function QualificationView({
  round,
  qualCenterData = { groups: [], qualifications: [] },
  onFinalizeQualifications,
  onReopenQualifications,
  isReadOnly = false,
  canManageQualifications = true,
  loading = false,
}) {
  const isFinalized = Boolean(round?.qualificationsFinalizedAt || qualCenterData.isFinalized);
  const groups = qualCenterData.groups || [];
  const existingQuals = qualCenterData.qualifications || [];

  // Selected teams map: { [teamId]: { teamId, sourceGroupId, rank } }
  const [selectedTeams, setSelectedTeams] = useState({});
  const [topNCount, setTopNCount] = useState(4);
  const [error, setError] = useState('');

  useEffect(() => {
    const map = {};
    existingQuals.forEach((q) => {
      map[q.teamId] = {
        teamId: q.teamId,
        sourceGroupId: q.sourceGroupId,
        rank: q.rankAtQualification,
      };
    });
    setSelectedTeams(map);
  }, [existingQuals]);

  // Automated "Select Top N" per group based on group leaderboard
  const handleSelectTopN = () => {
    const map = {};
    groups.forEach((grp) => {
      const sortedTeams = grp.leaderboard && grp.leaderboard.length > 0
        ? grp.leaderboard
        : grp.teams || [];

      sortedTeams.slice(0, Number(topNCount)).forEach((t, idx) => {
        const teamId = t.teamId || t.id;
        map[teamId] = {
          teamId,
          sourceGroupId: grp.id,
          rank: t.rank || idx + 1,
        };
      });
    });
    setSelectedTeams(map);
  };

  const handleToggleTeam = (teamId, groupId, rank) => {
    setSelectedTeams((prev) => {
      const next = { ...prev };
      if (next[teamId]) {
        delete next[teamId];
      } else {
        next[teamId] = { teamId, sourceGroupId: groupId, rank: rank || 1 };
      }
      return next;
    });
  };

  const handleConfirmFinalize = async () => {
    const selections = Object.values(selectedTeams);
    if (selections.length === 0) {
      setError('Please select at least one qualifying team.');
      return;
    }
    setError('');

    try {
      await onFinalizeQualifications(round.id, selections);
    } catch (err) {
      setError(err.message || 'Failed to finalize qualifications.');
    }
  };

  const handleReopen = async () => {
    if (!window.confirm('Reopen qualifications for this round? This will allow changing qualifying teams.')) return;
    try {
      await onReopenQualifications(round.id);
    } catch (err) {
      setError(err.message || 'Failed to reopen qualifications.');
    }
  };

  const totalSelected = Object.keys(selectedTeams).length;

  return (
    <div>
      {/* Top Header & Summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff' }}>
              Round {round?.roundNumber} Qualification Center
            </h2>
            <span className={`comp-status-badge ${isFinalized ? 'comp-status-completed' : 'comp-status-draft'}`}>
              {isFinalized ? 'Finalized' : 'In Progress'}
            </span>
          </div>
          <span style={{ fontSize: '12px', color: '#8b949e' }}>
            Select teams that will advance to the next round of competition.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {!isFinalized && !isReadOnly && canManageQualifications && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.04)', padding: '4px 10px', borderRadius: '6px' }}>
              <span style={{ fontSize: '12px', color: '#c9d1d9' }}>Auto-Select Top:</span>
              <input
                className="comp-input"
                type="number"
                min="1"
                max="20"
                style={{ width: '60px', padding: '4px 8px', fontSize: '12px' }}
                value={topNCount}
                onChange={(e) => setTopNCount(e.target.value)}
              />
              <button
                className="button secondary-button"
                type="button"
                style={{ minHeight: '28px', padding: '0 10px', fontSize: '11px' }}
                onClick={handleSelectTopN}
              >
                Apply
              </button>
            </div>
          )}

          {!isReadOnly && canManageQualifications && (
            isFinalized ? (
              <button
                className="button secondary-button"
                type="button"
                style={{ minHeight: '34px', padding: '0 14px', fontSize: '12px' }}
                onClick={handleReopen}
                disabled={loading}
              >
                Reopen Qualifications
              </button>
            ) : (
              <button
                className="button primary-button"
                type="button"
                style={{ minHeight: '34px', padding: '0 16px', fontSize: '13px' }}
                onClick={handleConfirmFinalize}
                disabled={loading || totalSelected === 0}
              >
                {loading ? 'Finalizing...' : `Confirm Qualification (${totalSelected} Teams)`}
              </button>
            )
          )}
        </div>
      </div>

      {error && <div className="comp-alert comp-alert-error">{error}</div>}

      {/* Summary Strip */}
      <div style={{ background: 'rgba(22, 27, 34, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '14px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {groups.map((grp) => {
            const countInGroup = Object.values(selectedTeams).filter((s) => s.sourceGroupId === grp.id).length;
            return (
              <div key={grp.id} style={{ fontSize: '13px' }}>
                <span style={{ color: '#8b949e' }}>{grp.name}: </span>
                <strong style={{ color: countInGroup > 0 ? '#2ecc71' : '#fff' }}>
                  {countInGroup} qualified
                </strong>
              </div>
            );
          })}
        </div>

        <div>
          <span style={{ fontSize: '12px', color: '#8b949e', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Qualified: </span>
          <strong style={{ fontSize: '18px', color: '#f6c453' }}>{totalSelected} Teams</strong>
        </div>
      </div>

      {/* Group-by-Group Selection Cards */}
      {groups.length === 0 ? (
        <div className="comp-empty-state">
          <h3 className="comp-empty-state-title">No groups in this round</h3>
          <p className="comp-empty-state-desc">
            Qualification is available once groups and matches have been established.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {groups.map((grp) => {
            const teamRows = grp.leaderboard && grp.leaderboard.length > 0
              ? grp.leaderboard
              : grp.teams || [];

            return (
              <div
                key={grp.id}
                style={{
                  background: 'rgba(22, 27, 34, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#fff' }}>
                    {grp.name}
                  </h3>
                  <span className={`comp-status-badge comp-status-${grp.status?.toLowerCase().replaceAll('_', '-')}`}>
                    {grp.status}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {teamRows.map((t, idx) => {
                    const teamId = t.teamId || t.id;
                    const teamName = t.teamName || t.name;
                    const isSelected = Boolean(selectedTeams[teamId]);
                    const rankNum = t.rank || idx + 1;

                    return (
                      <label
                        key={teamId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          background: isSelected ? 'rgba(46, 204, 113, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                          border: `1px solid ${isSelected ? 'rgba(46, 204, 113, 0.3)' : 'rgba(255, 255, 255, 0.04)'}`,
                          borderRadius: '6px',
                          cursor: isFinalized || isReadOnly || !canManageQualifications ? 'default' : 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isFinalized || isReadOnly || !canManageQualifications}
                            onChange={() => handleToggleTeam(teamId, grp.id, rankNum)}
                          />
                          <span style={{ fontSize: '11px', color: '#7dd3fc', fontWeight: 'bold', width: '24px' }}>
                            #{rankNum}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? '#fff' : '#c9d1d9' }}>
                            {teamName}
                          </span>
                        </div>

                        {t.points !== undefined && (
                          <span style={{ fontSize: '12px', color: '#f6c453', fontWeight: 'bold' }}>
                            {t.points} pts
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
