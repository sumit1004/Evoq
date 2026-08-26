import { useMemo, useState } from 'react';

export function RoundSetupWizard({
  roundNumber,
  eligibleTeamsCount = 0,
  isGenerating = false,
  isLocked = false,
  onGenerate,
}) {
  const [mode, setMode] = useState('BY_SIZE'); // 'BY_SIZE' | 'BY_GROUPS'
  const [groupCount, setGroupCount] = useState(
    Math.max(1, Math.ceil(eligibleTeamsCount / 12)) || 4
  );
  const [targetGroupSize, setTargetGroupSize] = useState(12);
  const [seedingEnabled, setSeedingEnabled] = useState(true);
  const [avoidRematch, setAvoidRematch] = useState(true);

  // Live preview distribution calculations
  const distributionSummary = useMemo(() => {
    const N = eligibleTeamsCount;
    if (!N) return null;

    let K = 1;
    if (mode === 'BY_SIZE') {
      const size = Math.max(1, Number(targetGroupSize) || 12);
      K = Math.max(1, Math.ceil(N / size));
    } else {
      K = Math.max(1, Math.min(N, Number(groupCount) || 1));
    }

    const baseSize = Math.floor(N / K);
    const remainder = N % K;
    const largerGroupsCount = remainder;
    const standardGroupsCount = K - remainder;

    return {
      totalTeams: N,
      calculatedGroups: K,
      largerGroupsCount,
      largerSize: baseSize + 1,
      standardGroupsCount,
      standardSize: baseSize,
      isBalanced: true,
      maxDiff: remainder > 0 ? 1 : 0,
    };
  }, [eligibleTeamsCount, mode, groupCount, targetGroupSize]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isGenerating || isLocked) return;

    onGenerate({
      mode,
      groupCount: mode === 'BY_GROUPS' ? Number(groupCount) : undefined,
      targetGroupSize: mode === 'BY_SIZE' ? Number(targetGroupSize) : undefined,
      seedingEnabled,
      avoidRematch,
    });
  };

  return (
    <div className="round-setup-wizard-card">
      <div className="wizard-header">
        <div>
          <span className="wizard-kicker">Automated Group Setup</span>
          <h2 className="wizard-title">Configure Round {roundNumber} Distribution</h2>
        </div>
        <div className="eligible-badge">
          <strong>{eligibleTeamsCount}</strong> Eligible Teams
        </div>
      </div>

      <form className="wizard-form" onSubmit={handleSubmit}>
        <div className="wizard-mode-toggle">
          <label className="mode-option">
            <input
              type="radio"
              name="assignmentMode"
              value="BY_SIZE"
              checked={mode === 'BY_SIZE'}
              onChange={() => setMode('BY_SIZE')}
              disabled={isLocked}
            />
            <span className="mode-label">
              <strong>Target Group Size</strong>
              <small>System calculates optimal balanced groups</small>
            </span>
          </label>

          <label className="mode-option">
            <input
              type="radio"
              name="assignmentMode"
              value="BY_GROUPS"
              checked={mode === 'BY_GROUPS'}
              onChange={() => setMode('BY_GROUPS')}
              disabled={isLocked}
            />
            <span className="mode-label">
              <strong>Exact Group Count</strong>
              <small>Specify exact number of groups</small>
            </span>
          </label>
        </div>

        <div className="wizard-inputs-grid">
          {mode === 'BY_SIZE' ? (
            <div className="form-group">
              <label htmlFor="target-group-size">Target Group Size (Teams / Group)</label>
              <input
                id="target-group-size"
                type="number"
                min="2"
                max="100"
                value={targetGroupSize}
                onChange={(e) => setTargetGroupSize(e.target.value)}
                disabled={isLocked || isGenerating}
                required
              />
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="group-count">Number of Groups</label>
              <input
                id="group-count"
                type="number"
                min="1"
                max={Math.max(1, eligibleTeamsCount)}
                value={groupCount}
                onChange={(e) => setGroupCount(e.target.value)}
                disabled={isLocked || isGenerating}
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
                disabled={isLocked || isGenerating}
              />
              <span>
                <strong>Balanced Snake Seeding</strong>
                <small>Distributes top-performing seeds across separate groups</small>
              </span>
            </label>

            {roundNumber > 1 && (
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={avoidRematch}
                  onChange={(e) => setAvoidRematch(e.target.checked)}
                  disabled={isLocked || isGenerating}
                />
                <span>
                  <strong>Avoid Previous Group Rematches</strong>
                  <small>Separates teams that played in the same previous round group</small>
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Live Calculation Preview Strip */}
        {distributionSummary && (
          <div className="distribution-preview-strip">
            <div className="preview-stat-item">
              <span className="stat-label">Calculated Groups</span>
              <strong className="stat-value">{distributionSummary.calculatedGroups} Groups</strong>
            </div>
            <div className="preview-stat-item">
              <span className="stat-label">Distribution Balance</span>
              <strong className="stat-value">
                {distributionSummary.largerGroupsCount > 0
                  ? `${distributionSummary.largerGroupsCount} × ${distributionSummary.largerSize} teams, ${distributionSummary.standardGroupsCount} × ${distributionSummary.standardSize} teams`
                  : `${distributionSummary.standardGroupsCount} × ${distributionSummary.standardSize} teams`}
              </strong>
            </div>
            <div className="preview-stat-item">
              <span className="stat-label">Max Size Variance</span>
              <strong className="stat-value">{distributionSummary.maxDiff} team diff (Balanced)</strong>
            </div>
          </div>
        )}

        <div className="wizard-actions-bar">
          <button
            className="button primary-button generate-btn"
            type="submit"
            disabled={isLocked || isGenerating || eligibleTeamsCount === 0}
          >
            {isGenerating ? 'Generating Balanced Assignment...' : 'Generate Assignment'}
          </button>
        </div>
      </form>
    </div>
  );
}
