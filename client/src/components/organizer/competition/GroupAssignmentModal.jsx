import { useState, useMemo } from 'react';

export function GroupAssignmentModal({
  isOpen,
  onClose,
  round,
  eligibleTeams = [],
  onConfirmAssignment,
  loading = false,
}) {
  const [step, setStep] = useState(1); // 1: Info, 2: Config, 3: Preview
  const [groupCount, setGroupCount] = useState(4);
  const [teamsPerGroup, setTeamsPerGroup] = useState(12);
  const [distributionMode, setDistributionMode] = useState('BALANCED'); // BALANCED, RANDOM, SEEDED
  const [avoidRematch, setAvoidRematch] = useState(true);

  if (!isOpen) return null;

  const totalEligible = eligibleTeams.length;

  // Compute preview distribution based on current configuration
  const previewGroups = useMemo(() => {
    if (totalEligible === 0) return [];

    const numGroups = Math.max(1, Math.min(totalEligible, Number(groupCount) || 1));
    const groups = Array.from({ length: numGroups }, (_, i) => ({
      name: `Group ${String.fromCharCode(65 + i)}`,
      teams: [],
    }));

    let teamsList = [...eligibleTeams];

    if (distributionMode === 'RANDOM') {
      teamsList.sort(() => Math.random() - 0.5);
    } else if (distributionMode === 'SEEDED') {
      teamsList.sort((a, b) => (a.rankAtQualification || a.rank_at_qualification || 999) - (b.rankAtQualification || b.rank_at_qualification || 999));
    }

    // Snake draft distribution
    for (let i = 0; i < teamsList.length; i++) {
      const roundNum = Math.floor(i / numGroups);
      const isReverse = roundNum % 2 === 1;
      const slot = i % numGroups;
      const groupIdx = isReverse ? numGroups - 1 - slot : slot;

      if (groups[groupIdx]) {
        groups[groupIdx].teams.push(teamsList[i]);
      }
    }

    return groups;
  }, [eligibleTeams, totalEligible, groupCount, distributionMode]);

  const handleGroupCountChange = (val) => {
    const num = Math.max(1, Number(val) || 1);
    setGroupCount(num);
    setTeamsPerGroup(Math.ceil(totalEligible / num));
  };

  const handleTeamsPerGroupChange = (val) => {
    const size = Math.max(1, Number(val) || 1);
    setTeamsPerGroup(size);
    setGroupCount(Math.max(1, Math.ceil(totalEligible / size)));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirmAssignment({
      groupCount: Number(groupCount),
      targetGroupSize: Number(teamsPerGroup),
      mode: 'BY_COUNT',
      seedingEnabled: distributionMode !== 'RANDOM',
      avoidRematch,
    });
  };

  return (
    <div className="comp-modal-overlay" role="dialog" aria-modal="true">
      <div className="comp-modal" style={{ maxWidth: '680px' }}>
        <div className="comp-modal-header">
          <div>
            <span style={{ fontSize: '11px', color: '#7dd3fc', textTransform: 'uppercase', fontWeight: 'bold' }}>
              Step {step} of 3
            </span>
            <h2 className="comp-modal-title">
              {step === 1 && 'Group Creation: Eligible Teams'}
              {step === 2 && 'Group Configuration'}
              {step === 3 && 'Review Group Assignment Preview'}
            </h2>
          </div>
          <button className="comp-modal-close" onClick={onClose} type="button" aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Step 1: Eligible Teams Status */}
        {step === 1 && (
          <div>
            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', color: '#8b949e', display: 'block' }}>
                Round {round?.roundNumber}: {round?.name}
              </span>
              <strong style={{ fontSize: '24px', color: '#2ecc71', display: 'block', margin: '4px 0' }}>
                {totalEligible} Eligible Verified Teams
              </strong>
              <p style={{ margin: 0, fontSize: '13px', color: '#8b949e' }}>
                {round?.roundNumber === 1
                  ? 'All verified team registrations in this tournament are available for assignment.'
                  : 'Teams qualified from the previous round are available for assignment.'}
              </p>
            </div>

            {totalEligible === 0 ? (
              <div className="comp-alert comp-alert-warning">
                No eligible verified teams found. Please verify team registrations before creating groups.
              </div>
            ) : (
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px' }}>
                <span style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  Available Teams Sample ({totalEligible} Total)
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '6px', marginTop: '8px' }}>
                  {eligibleTeams.slice(0, 18).map((t) => (
                    <div key={t.id} style={{ fontSize: '12px', padding: '4px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }}>
                      {t.name}
                    </div>
                  ))}
                  {totalEligible > 18 && (
                    <div style={{ fontSize: '12px', padding: '4px 8px', color: '#7dd3fc' }}>
                      +{totalEligible - 18} more teams...
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="comp-modal-footer">
              <button className="button secondary-button" type="button" onClick={onClose}>
                Cancel
              </button>
              <button
                className="button primary-button"
                type="button"
                disabled={totalEligible === 0}
                onClick={() => setStep(2)}
              >
                Next: Configure Groups →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Configuration */}
        {step === 2 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="comp-form-group">
                <label className="comp-label">Number of Groups</label>
                <input
                  className="comp-input"
                  type="number"
                  min="1"
                  max={totalEligible}
                  value={groupCount}
                  onChange={(e) => handleGroupCountChange(e.target.value)}
                />
                <span className="comp-input-hint">Total groups to create</span>
              </div>

              <div className="comp-form-group">
                <label className="comp-label">Teams Per Group</label>
                <input
                  className="comp-input"
                  type="number"
                  min="1"
                  max={totalEligible}
                  value={teamsPerGroup}
                  onChange={(e) => handleTeamsPerGroupChange(e.target.value)}
                />
                <span className="comp-input-hint">Target capacity per group</span>
              </div>
            </div>

            <div className="comp-form-group">
              <label className="comp-label">Distribution Method</label>
              <select
                className="comp-select"
                value={distributionMode}
                onChange={(e) => setDistributionMode(e.target.value)}
              >
                <option value="BALANCED">Balanced (Snake Draft - Recommended)</option>
                <option value="SEEDED">Seeded (By Previous Rank)</option>
                <option value="RANDOM">Random (Shuffled Distribution)</option>
              </select>
              <span className="comp-input-hint">
                Balanced distribution alternates allocation to ensure equitable skill and competitive integrity.
              </span>
            </div>

            <div className="comp-form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#c9d1d9' }}>
                <input
                  type="checkbox"
                  checked={avoidRematch}
                  onChange={(e) => setAvoidRematch(e.target.checked)}
                />
                Avoid rematches from same prior group where possible
              </label>
            </div>

            <div className="comp-modal-footer">
              <button className="button secondary-button" type="button" onClick={() => setStep(1)}>
                ← Back
              </button>
              <button className="button primary-button" type="button" onClick={() => setStep(3)}>
                Preview Groups →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review Preview */}
        {step === 3 && (
          <div>
            <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#8b949e' }}>
              Review the calculated group distribution before committing to the database.
            </p>

            <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
              {previewGroups.map((grp) => (
                <div key={grp.name} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ color: '#fff', fontSize: '13px' }}>{grp.name}</strong>
                    <span style={{ fontSize: '11px', color: '#7dd3fc' }}>{grp.teams.length} Teams</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#8b949e', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {grp.teams.slice(0, 4).map((t) => (
                      <span key={t.id} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        • {t.name}
                      </span>
                    ))}
                    {grp.teams.length > 4 && (
                      <span style={{ color: '#58a6ff' }}>+{grp.teams.length - 4} more...</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="comp-modal-footer">
              <button className="button secondary-button" type="button" onClick={() => setStep(2)}>
                ← Back
              </button>
              <button
                className="button primary-button"
                type="button"
                disabled={loading}
                onClick={handleSubmit}
              >
                {loading ? 'Creating Groups...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
