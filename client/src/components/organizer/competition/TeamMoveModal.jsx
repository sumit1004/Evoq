import { useState } from 'react';

export function TeamMoveModal({
  isOpen,
  onClose,
  team,
  currentGroup,
  availableGroups = [],
  onConfirmMove,
  loading = false,
}) {
  const [targetGroupId, setTargetGroupId] = useState('');
  const [error, setError] = useState('');

  if (!isOpen || !team) return null;

  const candidateGroups = availableGroups.filter((g) => g.id !== currentGroup?.id);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!targetGroupId) {
      setError('Please select a destination group.');
      return;
    }
    setError('');
    onConfirmMove(team.id, Number(targetGroupId));
  };

  return (
    <div className="comp-modal-overlay" role="dialog" aria-modal="true">
      <div className="comp-modal" style={{ maxWidth: '460px' }}>
        <div className="comp-modal-header">
          <h2 className="comp-modal-title">Move Team: {team.name}</h2>
          <button className="comp-modal-close" onClick={onClose} type="button" aria-label="Close modal">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
            <span style={{ color: '#8b949e' }}>Current Location: </span>
            <strong style={{ color: '#fff' }}>{currentGroup?.name}</strong>
          </div>

          {error && <div className="comp-alert comp-alert-error">{error}</div>}

          <div className="comp-form-group">
            <label className="comp-label">Target Destination Group</label>
            <select
              className="comp-select"
              value={targetGroupId}
              onChange={(e) => setTargetGroupId(e.target.value)}
              required
            >
              <option value="">-- Select Destination Group --</option>
              {candidateGroups.map((grp) => {
                const teamCount = grp.teams?.length || 0;
                const capacity = grp.groupSize || 12;
                const isFull = teamCount >= capacity;
                return (
                  <option key={grp.id} value={grp.id} disabled={isFull}>
                    {grp.name} ({teamCount} / {capacity} teams) {isFull ? '- FULL' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="comp-modal-footer">
            <button className="button secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="button primary-button"
              type="submit"
              disabled={loading || !targetGroupId}
            >
              {loading ? 'Moving Team...' : 'Confirm Move'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
