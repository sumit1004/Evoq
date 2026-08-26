import { useState } from 'react';

export function NextRoundModal({
  tournamentId,
  currentRoundNumber,
  qualifiedTeams = [],
  isCreating = false,
  isOpen = false,
  onClose,
  onSubmit,
}) {
  const nextRoundNumber = (Number(currentRoundNumber) || 1) + 1;
  const [name, setName] = useState(`Round ${nextRoundNumber}`);
  const [mode, setMode] = useState('BY_SIZE');
  const [targetGroupSize, setTargetGroupSize] = useState(12);
  const [groupCount, setGroupCount] = useState(
    Math.max(1, Math.ceil(qualifiedTeams.length / 12)) || 4
  );
  const [seedingEnabled, setSeedingEnabled] = useState(true);
  const [avoidRematch, setAvoidRematch] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isCreating) return;

    onSubmit({
      name: name.trim(),
      mode,
      targetGroupSize: mode === 'BY_SIZE' ? Number(targetGroupSize) : undefined,
      groupCount: mode === 'BY_GROUPS' ? Number(groupCount) : undefined,
      seedingEnabled,
      avoidRematch,
      autoAssign: true,
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content modal-large">
        <div className="modal-header-row">
          <div>
            <span className="page-kicker">Multi-Round Progression</span>
            <h3>Create Round {nextRoundNumber}</h3>
          </div>
          <button
            className="button ghost-button close-modal-btn"
            type="button"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="next-round-banner">
            <strong>{qualifiedTeams.length} Qualified Teams</strong> will automatically enter Round {nextRoundNumber}.
          </div>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label htmlFor="next-round-name">Round Name</label>
            <input
              id="next-round-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="wizard-mode-toggle" style={{ marginTop: '16px' }}>
            <label className="mode-option">
              <input
                type="radio"
                name="nextRoundMode"
                value="BY_SIZE"
                checked={mode === 'BY_SIZE'}
                onChange={() => setMode('BY_SIZE')}
              />
              <span className="mode-label">
                <strong>Target Group Size</strong>
                <small>Auto-calculates balanced groups</small>
              </span>
            </label>

            <label className="mode-option">
              <input
                type="radio"
                name="nextRoundMode"
                value="BY_GROUPS"
                checked={mode === 'BY_GROUPS'}
                onChange={() => setMode('BY_GROUPS')}
              />
              <span className="mode-label">
                <strong>Exact Group Count</strong>
                <small>Set explicit group count</small>
              </span>
            </label>
          </div>

          <div className="wizard-inputs-grid" style={{ marginTop: '16px' }}>
            {mode === 'BY_SIZE' ? (
              <div className="form-group">
                <label htmlFor="modal-target-size">Target Group Size (Teams / Group)</label>
                <input
                  id="modal-target-size"
                  type="number"
                  min="2"
                  max="100"
                  value={targetGroupSize}
                  onChange={(e) => setTargetGroupSize(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="form-group">
                <label htmlFor="modal-group-count">Number of Groups</label>
                <input
                  id="modal-group-count"
                  type="number"
                  min="1"
                  max={Math.max(1, qualifiedTeams.length)}
                  value={groupCount}
                  onChange={(e) => setGroupCount(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="wizard-options-column">
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={seedingEnabled}
                  onChange={(e) => setSeedingEnabled(e.target.checked)}
                />
                <span>
                  <strong>Balanced Snake Seeding</strong>
                  <small>Distributes top seeds evenly</small>
                </span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={avoidRematch}
                  onChange={(e) => setAvoidRematch(e.target.checked)}
                />
                <span>
                  <strong>Avoid Previous Group Rematches</strong>
                  <small>Separates teams from same Round {currentRoundNumber} group</small>
                </span>
              </label>
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '24px' }}>
            <button
              className="button secondary-button"
              type="button"
              onClick={onClose}
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              className="button primary-button"
              type="submit"
              disabled={isCreating || qualifiedTeams.length === 0}
            >
              {isCreating ? 'Creating & Distributing...' : `Create Round ${nextRoundNumber} & Auto-Group`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
