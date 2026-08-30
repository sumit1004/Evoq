import { useState } from 'react';

export function NextRoundWizard({
  isOpen,
  onClose,
  currentRound,
  qualifiedTeamsCount = 0,
  onCreateNextRound,
  loading = false,
}) {
  const nextRoundNumber = (currentRound?.roundNumber || 1) + 1;
  const [name, setName] = useState(`Round ${nextRoundNumber}`);
  const [groupCount, setGroupCount] = useState(
    Math.max(1, Math.ceil(qualifiedTeamsCount / 12)) || 1
  );
  const [teamsPerGroup, setTeamsPerGroup] = useState(
    Math.min(qualifiedTeamsCount, 12) || 12
  );
  const [step, setStep] = useState(1); // 1: Config, 2: Preview

  if (!isOpen) return null;

  const handleGroupCountChange = (val) => {
    const count = Math.max(1, Number(val) || 1);
    setGroupCount(count);
    setTeamsPerGroup(Math.ceil(qualifiedTeamsCount / count));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreateNextRound({
      name: name.trim() || `Round ${nextRoundNumber}`,
      roundNumber: nextRoundNumber,
      groupCount: Number(groupCount),
      targetGroupSize: Number(teamsPerGroup),
      autoAssign: true,
    });
  };

  return (
    <div className="comp-modal-overlay" role="dialog" aria-modal="true">
      <div className="comp-modal" style={{ maxWidth: '580px' }}>
        <div className="comp-modal-header">
          <div>
            <span style={{ fontSize: '11px', color: '#7dd3fc', textTransform: 'uppercase', fontWeight: 'bold' }}>
              Step {step} of 2
            </span>
            <h2 className="comp-modal-title">
              {step === 1 ? `Initialize Round ${nextRoundNumber}` : `Preview Round ${nextRoundNumber} Setup`}
            </h2>
          </div>
          <button className="comp-modal-close" onClick={onClose} type="button" aria-label="Close modal">
            ✕
          </button>
        </div>

        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); setStep(2); }}>
            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', color: '#8b949e' }}>Previous Round Qualifications</span>
              <strong style={{ fontSize: '22px', color: '#2ecc71', display: 'block', margin: '4px 0' }}>
                {qualifiedTeamsCount} Teams Qualified
              </strong>
              <p style={{ margin: 0, fontSize: '13px', color: '#8b949e' }}>
                Only the {qualifiedTeamsCount} verified teams qualified from Round {currentRound?.roundNumber} will enter Round {nextRoundNumber}.
              </p>
            </div>

            <div className="comp-form-group">
              <label className="comp-label">Round Name</label>
              <input
                className="comp-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="comp-form-group">
                <label className="comp-label">Number of Groups</label>
                <input
                  className="comp-input"
                  type="number"
                  min="1"
                  max={qualifiedTeamsCount || 10}
                  value={groupCount}
                  onChange={(e) => handleGroupCountChange(e.target.value)}
                  required
                />
              </div>

              <div className="comp-form-group">
                <label className="comp-label">Teams Per Group</label>
                <input
                  className="comp-input"
                  type="number"
                  min="1"
                  max={qualifiedTeamsCount || 24}
                  value={teamsPerGroup}
                  onChange={(e) => setTeamsPerGroup(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="comp-modal-footer">
              <button className="button secondary-button" type="button" onClick={onClose}>
                Cancel
              </button>
              <button className="button primary-button" type="submit">
                Preview Setup →
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div>
            <div style={{ padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#8b949e', fontSize: '13px' }}>Round Title:</span>
                <strong style={{ color: '#fff', fontSize: '13px' }}>{name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#8b949e', fontSize: '13px' }}>Groups to create:</span>
                <strong style={{ color: '#7dd3fc', fontSize: '13px' }}>{groupCount} Groups</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8b949e', fontSize: '13px' }}>Teams to assign:</span>
                <strong style={{ color: '#2ecc71', fontSize: '13px' }}>{qualifiedTeamsCount} Qualified Teams</strong>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: '#8b949e', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Confirming will create Round {nextRoundNumber}, generate {groupCount} groups, and automatically distribute all {qualifiedTeamsCount} qualified teams in a single transaction.
            </p>

            <div className="comp-modal-footer">
              <button className="button secondary-button" type="button" onClick={() => setStep(1)}>
                ← Back
              </button>
              <button
                className="button primary-button"
                type="button"
                disabled={loading}
                onClick={handleSubmit}
              >
                {loading ? 'Creating Round...' : `Create Round ${nextRoundNumber} Now`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
