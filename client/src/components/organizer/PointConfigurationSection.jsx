import { useCallback, useEffect, useState } from 'react';
import { fetchScoringConfig, updateScoringConfig } from '../../services/tournamentApi.js';

export function PointConfigurationSection({ tournamentId, isCompleted = false }) {
  const [scoringMode, setScoringMode] = useState('KILLS_AND_POSITION');
  const [killPoints, setKillPoints] = useState(1);
  const [positionPoints, setPositionPoints] = useState([]);
  const [newPosition, setNewPosition] = useState('');
  const [newPoints, setNewPoints] = useState(0);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchScoringConfig(tournamentId);
      const cfg = res.config;
      setScoringMode(cfg.scoringMode || 'KILLS_AND_POSITION');
      setKillPoints(cfg.killPointsPerKill ?? 1);
      setPositionPoints(cfg.positionPoints || []);
    } catch (err) {
      setError(err.message || 'Failed to load scoring configuration');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handlePositionPointChange = (position, pointsVal) => {
    setPositionPoints((prev) =>
      prev.map((p) =>
        p.position === position ? { ...p, points: Math.max(0, Number(pointsVal) || 0) } : p
      )
    );
  };

  const handleAddPosition = (e) => {
    e.preventDefault();
    const posNum = Number(newPosition);
    if (!posNum || posNum < 1 || !Number.isInteger(posNum)) {
      setError('Position must be a positive integer.');
      return;
    }
    if (positionPoints.some((p) => p.position === posNum)) {
      setError(`Position ${posNum} is already in the list.`);
      return;
    }

    const updated = [...positionPoints, { position: posNum, points: Math.max(0, Number(newPoints) || 0) }];
    updated.sort((a, b) => a.position - b.position);
    setPositionPoints(updated);
    setNewPosition('');
    setNewPoints(0);
    setError('');
  };

  const handleRemovePosition = (position) => {
    setPositionPoints((prev) => prev.filter((p) => p.position !== position));
  };

  const handleSaveConfirmed = async () => {
    setSubmitting(true);
    setError('');
    setNotice('');
    setShowConfirmModal(false);

    try {
      const res = await updateScoringConfig(tournamentId, {
        scoringMode,
        killPointsPerKill: Number(killPoints),
        positionPoints,
      });
      const cfg = res.config;
      setScoringMode(cfg.scoringMode);
      setKillPoints(cfg.killPointsPerKill);
      setPositionPoints(cfg.positionPoints || []);
      setNotice('Scoring configuration updated. Newly recorded match results will use this configuration. Previously submitted results will remain unchanged.');
    } catch (err) {
      setError(err.message || 'Failed to update scoring configuration');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="point-config-card" style={{ padding: '24px' }}>
        <p className="status-panel">Loading point configuration...</p>
      </div>
    );
  }

  return (
    <div className="point-config-container">
      <div className="point-config-card">
        <div className="section-head" style={{ marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#fff' }}>POINT CONFIGURATION</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#91a0b3' }}>
              Configure how match scores and points are calculated for this tournament.
            </p>
          </div>
        </div>

        {error && <div className="form-alert" role="alert" style={{ marginBottom: '16px' }}>{error}</div>}
        {notice && <div className="status-panel" role="status" style={{ marginBottom: '16px', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)', color: '#34d399' }}>{notice}</div>}

        {/* SCORING MODE SELECTION */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '700', fontSize: '14px', color: '#e5edf7' }}>
            SCORING MODE
          </label>
          <div className="scoring-mode-selector">
            <button
              type="button"
              className={`scoring-mode-card ${scoringMode === 'KILLS_AND_POSITION' ? 'is-selected' : ''}`}
              onClick={() => setScoringMode('KILLS_AND_POSITION')}
              disabled={isCompleted || submitting}
            >
              <div className="mode-card-radio">
                <span className={`radio-dot ${scoringMode === 'KILLS_AND_POSITION' ? 'active' : ''}`} />
              </div>
              <div className="mode-card-content">
                <strong>Calculate by Kills + Position</strong>
                <p>Calculate team points from kills and finishing position.</p>
              </div>
            </button>

            <button
              type="button"
              className={`scoring-mode-card ${scoringMode === 'TOTAL_SCORE' ? 'is-selected' : ''}`}
              onClick={() => setScoringMode('TOTAL_SCORE')}
              disabled={isCompleted || submitting}
            >
              <div className="mode-card-radio">
                <span className={`radio-dot ${scoringMode === 'TOTAL_SCORE' ? 'active' : ''}`} />
              </div>
              <div className="mode-card-content">
                <strong>Calculate by Total Score</strong>
                <p>Enter the final score directly for each team.</p>
              </div>
            </button>
          </div>
        </div>

        {/* KILLS + POSITION MODE CONTROLS */}
        {scoringMode === 'KILLS_AND_POSITION' && (
          <div className="mode-details-box">
            {/* Kill Points Configuration */}
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="kill-points-input" style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '14px', color: '#e5edf7' }}>
                KILL POINTS
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: '#91a0b3' }}>Points per kill:</span>
                <input
                  id="kill-points-input"
                  type="number"
                  min="0"
                  step="0.5"
                  value={killPoints}
                  onChange={(e) => setKillPoints(Math.max(0, Number(e.target.value) || 0))}
                  disabled={isCompleted || submitting}
                  style={{ width: '90px', minHeight: '40px', padding: '6px 12px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#fff', fontWeight: '700' }}
                />
              </div>
            </div>

            {/* Position Points Configuration Table */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <label style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: '#e5edf7' }}>
                  POSITION POINTS
                </label>
                <span style={{ fontSize: '12px', color: '#91a0b3' }}>
                  {positionPoints.length} positions configured
                </span>
              </div>

              <div className="table-responsive-box" style={{ marginBottom: '16px' }}>
                <table className="esports-table" style={{ width: '100%', minWidth: '380px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '100px' }}>POSITION</th>
                      <th>POINTS</th>
                      {!isCompleted && <th style={{ width: '90px', textAlign: 'right' }}>ACTION</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {positionPoints.map((row) => (
                      <tr key={row.position}>
                        <td style={{ fontWeight: '700', color: '#7dd3fc' }}>
                          Position {row.position}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={row.points}
                            onChange={(e) => handlePositionPointChange(row.position, e.target.value)}
                            disabled={isCompleted || submitting}
                            style={{ width: '100px', minHeight: '36px', padding: '4px 8px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff', fontWeight: '600' }}
                          />
                        </td>
                        {!isCompleted && (
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="button ghost-button mini-btn"
                              onClick={() => handleRemovePosition(row.position)}
                              disabled={submitting}
                              style={{ color: '#ef4444', padding: '4px 8px', minHeight: '30px' }}
                            >
                              Remove
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Custom Position */}
              {!isCompleted && (
                <form onSubmit={handleAddPosition} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', color: '#91a0b3' }}>Pos:</span>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 13"
                      value={newPosition}
                      onChange={(e) => setNewPosition(e.target.value)}
                      disabled={submitting}
                      style={{ width: '80px', minHeight: '36px', padding: '4px 8px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', color: '#91a0b3' }}>Pts:</span>
                    <input
                      type="number"
                      min="0"
                      value={newPoints}
                      onChange={(e) => setNewPoints(e.target.value)}
                      disabled={submitting}
                      style={{ width: '80px', minHeight: '36px', padding: '4px 8px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#fff' }}
                    />
                  </div>
                  <button type="submit" className="button secondary-button" disabled={submitting || !newPosition} style={{ minHeight: '36px', padding: '4px 12px' }}>
                    + Add Position
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* SAVE BUTTON */}
        {!isCompleted && (
          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-start' }}>
            <button
              type="button"
              className="button primary-button"
              onClick={() => setShowConfirmModal(true)}
              disabled={submitting}
            >
              {submitting ? 'Saving Configuration...' : 'Save Point Configuration'}
            </button>
          </div>
        )}
      </div>

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-box" style={{ maxWidth: '440px' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '18px' }}>Confirm Configuration Update</h3>
            <p style={{ color: '#cdd6e2', fontSize: '14px', lineHeight: '1.5', margin: '0 0 20px 0' }}>
              Newly recorded match results will use this scoring configuration. Previously submitted results will remain unchanged.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="button ghost-button"
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button primary-button"
                onClick={handleSaveConfirmed}
                disabled={submitting}
              >
                {submitting ? 'Saving...' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
