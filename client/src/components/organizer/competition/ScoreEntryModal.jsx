import { useState, useEffect } from 'react';

export function ScoreEntryModal({
  isOpen,
  onClose,
  match,
  teams = [],
  scoringConfig = {},
  existingResults = [],
  onSaveScore,
  loading = false,
}) {
  const isTotalScoreMode = scoringConfig.scoringMode === 'TOTAL_SCORE';
  const killPointsPerKill = Number(scoringConfig.killPointsPerKill) || 1;
  const positionPointsList = scoringConfig.positionPoints || [
    { position: 1, points: 12 },
    { position: 2, points: 9 },
    { position: 3, points: 8 },
    { position: 4, points: 7 },
    { position: 5, points: 6 },
    { position: 6, points: 5 },
    { position: 7, points: 4 },
    { position: 8, points: 3 },
    { position: 9, points: 2 },
    { position: 10, points: 1 },
    { position: 11, points: 0 },
    { position: 12, points: 0 },
  ];

  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [kills, setKills] = useState(0);
  const [placement, setPlacement] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [resultText, setResultText] = useState('');
  const [error, setError] = useState('');

  // When team is selected, populate existing score if already entered
  useEffect(() => {
    if (selectedTeamId && existingResults.length > 0) {
      const found = existingResults.find((r) => Number(r.teamId) === Number(selectedTeamId));
      if (found) {
        setKills(found.kills ?? 0);
        setPlacement(found.placement ?? 1);
        setTotalScore(found.points ?? 0);
        setResultText(found.resultText || '');
        return;
      }
    }
    // Default values
    setKills(0);
    setPlacement(1);
    setTotalScore(0);
    setResultText('');
  }, [selectedTeamId, existingResults]);

  if (!isOpen || !match) return null;

  // Calculated preview points in KILLS_AND_POSITION mode
  const currentPosConfig = positionPointsList.find((p) => Number(p.position) === Number(placement));
  const posPoints = currentPosConfig ? Number(currentPosConfig.points) : 0;
  const killPoints = Math.max(0, Number(kills) || 0) * killPointsPerKill;
  const calculatedTotal = killPoints + posPoints;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTeamId) {
      setError('Please select a team.');
      return;
    }
    setError('');

    const payload = {
      teamId: Number(selectedTeamId),
      resultText: resultText.trim() || null,
    };

    if (isTotalScoreMode) {
      payload.points = Math.max(0, Number(totalScore) || 0);
      payload.totalScore = payload.points;
    } else {
      payload.kills = Math.max(0, Number(kills) || 0);
      payload.placement = Number(placement);
      payload.points = calculatedTotal;
    }

    try {
      await onSaveScore(match.id, payload);
      // Reset selected team or keep modal open for next team
      setSelectedTeamId('');
    } catch (err) {
      setError(err.message || 'Failed to save score.');
    }
  };

  return (
    <div className="comp-modal-overlay" role="dialog" aria-modal="true">
      <div className="comp-modal" style={{ maxWidth: '640px' }}>
        <div className="comp-modal-header">
          <div>
            <h2 className="comp-modal-title">Record Scores: {match.name || `Match ${match.matchNumber}`}</h2>
            <span style={{ fontSize: '11px', color: '#7dd3fc', textTransform: 'uppercase', fontWeight: 'bold' }}>
              Scoring Mode: {isTotalScoreMode ? 'Total Score Only' : 'Kills + Position'}
            </span>
          </div>
          <button className="comp-modal-close" onClick={onClose} type="button" aria-label="Close modal">
            ✕
          </button>
        </div>

        {error && <div className="comp-alert comp-alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="comp-form-group">
            <label className="comp-label">Select Competing Team</label>
            <select
              className="comp-select"
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              required
            >
              <option value="">-- Choose Team ({teams.length} in group) --</option>
              {teams.map((t) => {
                const recorded = existingResults.some((r) => Number(r.teamId) === Number(t.id));
                return (
                  <option key={t.id} value={t.id}>
                    {t.name} {recorded ? '✓ (Score Recorded)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Mode 1: Kills + Position */}
          {!isTotalScoreMode ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="comp-form-group">
                <label className="comp-label">Kills</label>
                <input
                  className="comp-input"
                  type="number"
                  min="0"
                  value={kills}
                  onChange={(e) => setKills(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  required
                />
                <span className="comp-input-hint">
                  {killPointsPerKill} pt{killPointsPerKill > 1 ? 's' : ''} per kill ({killPoints} pts)
                </span>
              </div>

              <div className="comp-form-group">
                <label className="comp-label">Placement Position</label>
                <select
                  className="comp-select"
                  value={placement}
                  onChange={(e) => setPlacement(Number(e.target.value))}
                  required
                >
                  {positionPointsList.map((p) => (
                    <option key={p.position} value={p.position}>
                      Rank #{p.position} ({p.points} pts)
                    </option>
                  ))}
                </select>
                <span className="comp-input-hint">Position points from tournament config</span>
              </div>
            </div>
          ) : (
            /* Mode 2: Total Score */
            <div className="comp-form-group">
              <label className="comp-label">Total Score / Points</label>
              <input
                className="comp-input"
                type="number"
                min="0"
                value={totalScore}
                onChange={(e) => setTotalScore(Math.max(0, parseFloat(e.target.value) || 0))}
                required
              />
              <span className="comp-input-hint">Enter the final accumulated points for this team</span>
            </div>
          )}

          {/* Points Preview Box */}
          {!isTotalScoreMode && (
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '6px', padding: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  Calculated Points Breakdown
                </span>
                <div style={{ fontSize: '13px', color: '#f0f6fc', marginTop: '2px' }}>
                  Kill Points: <strong>{killPoints}</strong> + Placement Points: <strong>{posPoints}</strong>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: '#7dd3fc', textTransform: 'uppercase', fontWeight: 'bold' }}>Total</span>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#f6c453' }}>{calculatedTotal} PTS</div>
              </div>
            </div>
          )}

          <div className="comp-form-group">
            <label className="comp-label">Notes / Round Details (Optional)</label>
            <input
              className="comp-input"
              type="text"
              placeholder="e.g. Booyah victory in final circle"
              value={resultText}
              onChange={(e) => setResultText(e.target.value)}
            />
          </div>

          {/* Summary of Already Submitted Results */}
          {existingResults.length > 0 && (
            <div style={{ marginTop: '16px', marginBottom: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
              <span style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', fontWeight: 'bold' }}>
                Submitted Results ({existingResults.length} / {teams.length} Teams)
              </span>
              <div style={{ maxHeight: '140px', overflowY: 'auto', marginTop: '8px' }}>
                <table className="comp-table" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Team</th>
                      {!isTotalScoreMode && <th>Kills</th>}
                      {!isTotalScoreMode && <th>Rank</th>}
                      <th>Total Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {existingResults.map((res) => (
                      <tr key={res.teamId || res.id}>
                        <td>{res.teamName || res.team_name}</td>
                        {!isTotalScoreMode && <td>{res.kills ?? 0}</td>}
                        {!isTotalScoreMode && <td>#{res.placement || res.position || '-'}</td>}
                        <td><strong style={{ color: '#f6c453' }}>{res.points}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="comp-modal-footer">
            <button className="button secondary-button" type="button" onClick={onClose}>
              Done / Close
            </button>
            <button
              className="button primary-button"
              type="submit"
              disabled={loading || !selectedTeamId}
            >
              {loading ? 'Saving...' : 'Save Team Score'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
