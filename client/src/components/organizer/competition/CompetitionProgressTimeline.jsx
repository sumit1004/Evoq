export function CompetitionProgressTimeline({ tournament, rounds = [] }) {
  if (!tournament) return null;

  // Build progression steps
  const steps = [];

  // Step 1: Registration
  const regStatus =
    tournament.status === 'COMPLETED' || tournament.status === 'LIVE' || tournament.status === 'REGISTRATION_CLOSED'
      ? 'COMPLETED'
      : tournament.status === 'REGISTRATION_OPEN'
      ? 'IN_PROGRESS'
      : 'NOT_STARTED';

  steps.push({
    id: 'registration',
    label: 'Registration',
    status: regStatus,
  });

  // Steps for each round and qualification
  rounds.forEach((round, idx) => {
    // Round Step
    steps.push({
      id: `round_${round.id}`,
      label: round.name || `Round ${round.roundNumber}`,
      status: round.status, // NOT_STARTED, IN_PROGRESS, COMPLETED
    });

    // If there are more rounds or qualification occurred
    if (round.qualificationsFinalizedAt || idx < rounds.length - 1) {
      steps.push({
        id: `qual_${round.id}`,
        label: `Qual ${round.roundNumber}`,
        status: round.qualificationsFinalizedAt ? 'COMPLETED' : round.status === 'COMPLETED' ? 'IN_PROGRESS' : 'NOT_STARTED',
      });
    }
  });

  // Final Step if tournament is completed or all rounds done
  if (rounds.length > 0) {
    const lastRound = rounds[rounds.length - 1];
    const isFinished = tournament.status === 'COMPLETED';
    steps.push({
      id: 'final_stage',
      label: 'Grand Finals',
      status: isFinished ? 'COMPLETED' : lastRound?.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'NOT_STARTED',
    });
  }

  const renderIndicator = (status, index) => {
    if (status === 'COMPLETED') return '✓';
    if (status === 'IN_PROGRESS') return '●';
    return String(index + 1);
  };

  return (
    <div className="comp-timeline-box" aria-label="Tournament Progression Timeline">
      <div className="comp-timeline-strip">
        {steps.map((step, idx) => {
          const stepClass =
            step.status === 'COMPLETED'
              ? 'comp-step-completed'
              : step.status === 'IN_PROGRESS'
              ? 'comp-step-in-progress'
              : 'comp-step-not-started';

          return (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className={`comp-timeline-step ${stepClass}`}>
                <div className="comp-step-indicator" title={`${step.label}: ${step.status}`}>
                  {renderIndicator(step.status, idx)}
                </div>
                <span className="comp-step-label">{step.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`comp-timeline-connector ${step.status === 'COMPLETED' ? 'completed' : ''}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
