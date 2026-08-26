import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  completeRound,
  createRound,
  fetchRounds,
  updateRound,
} from '../../services/competitionApi.js';

export function OrganizerRoundsPage() {
  const { tournamentId } = useParams();
  const [rounds, setRounds] = useState([]);
  const [form, setForm] = useState({ roundNumber: 1, name: 'Round 1' });
  const [state, setState] = useState({ loading: true, error: '', notice: '' });

  const load = useCallback(async () => {
    try {
      const result = await fetchRounds(tournamentId);
      const list = result.rounds || [];
      setRounds(list);
      const nextNum = list.length > 0 ? list[list.length - 1].roundNumber + 1 : 1;
      setForm({ roundNumber: nextNum, name: `Round ${nextNum}` });
      setState((s) => ({ ...s, loading: false }));
    } catch (error) {
      setState({ loading: false, error: error.message, notice: '' });
    }
  }, [tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(event) {
    event.preventDefault();
    try {
      const result = await createRound(tournamentId, {
        roundNumber: Number(form.roundNumber),
        name: form.name,
      });
      setRounds((current) => [...current, result.round].sort((a, b) => a.roundNumber - b.roundNumber));
      const nextNum = Number(form.roundNumber) + 1;
      setForm({ roundNumber: nextNum, name: `Round ${nextNum}` });
      setState((s) => ({ ...s, error: '', notice: 'Round created.' }));
    } catch (error) {
      setState((s) => ({ ...s, error: error.message, notice: '' }));
    }
  }

  async function start(round) {
    try {
      const result = await updateRound(round.id, { status: 'IN_PROGRESS' });
      setRounds((current) =>
        current.map((item) => (item.id === round.id ? result.round : item))
      );
      setState((s) => ({ ...s, error: '', notice: `${round.name} is now IN PROGRESS.` }));
    } catch (error) {
      setState((s) => ({ ...s, error: error.message, notice: '' }));
    }
  }

  async function handleComplete(round) {
    try {
      const result = await completeRound(round.id);
      setRounds((current) =>
        current.map((item) => (item.id === round.id ? result.round : item))
      );
      setState((s) => ({ ...s, error: '', notice: `${round.name} marked as COMPLETED.` }));
    } catch (error) {
      setState((s) => ({ ...s, error: error.message, notice: '' }));
    }
  }

  return (
    <section className="workspace-page">
      <Link className="text-link" to={`/organizer/tournaments/${tournamentId}`}>
        Back to tournament
      </Link>
      <div className="page-kicker">Competition setup</div>
      <h1>Tournament Progression & Rounds</h1>
      <p>
        Manage multi-round advancement, group assignment pipelines, and qualification centers.
      </p>

      {state.error && <div className="form-alert" role="alert">{state.error}</div>}
      {state.notice && <div className="success-alert" role="status">{state.notice}</div>}

      <div className="organizer-grid">
        <form className="team-form" onSubmit={submit}>
          <h2>Create Round</h2>
          <label htmlFor="round-number">Round number</label>
          <input
            id="round-number"
            type="number"
            min="1"
            value={form.roundNumber}
            onChange={(e) =>
              setForm({ roundNumber: e.target.value, name: `Round ${e.target.value}` })
            }
          />
          <label htmlFor="round-name">Name</label>
          <input
            id="round-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <button className="button primary-button" type="submit">
            Create Round
          </button>
        </form>

        <div className="team-list">
          <h2>Rounds Progression</h2>
          {state.loading && <p className="status-panel">Loading rounds...</p>}
          {!state.loading && !rounds.length && (
            <p className="empty-state">No rounds created yet. Create Round 1 to begin.</p>
          )}

          {rounds.map((round) => {
            const isLocked = round.isLocked || round.assignmentStatus === 'LOCKED';
            const isFinalized = Boolean(round.qualificationsFinalizedAt);

            return (
              <div className="competition-item round-progression-card" key={round.id}>
                <div>
                  <div className="round-status-badges-row">
                    <span className="tournament-status">Round {round.roundNumber}</span>
                    <span className={`status-badge ${round.status.toLowerCase()}`}>
                      {round.status.replaceAll('_', ' ')}
                    </span>
                    <span className={`status-badge ${isLocked ? 'completed' : 'draft'}`}>
                      {isLocked ? 'GROUPS LOCKED' : 'GROUPS DRAFT'}
                    </span>
                    {isFinalized && (
                      <span className="status-badge live">QUALIFICATION FINALIZED</span>
                    )}
                  </div>
                  <h3>{round.name}</h3>
                </div>

                <div className="competition-actions">
                  {round.status === 'NOT_STARTED' && (
                    <button
                      className="button secondary-button"
                      type="button"
                      onClick={() => start(round)}
                    >
                      Start Round
                    </button>
                  )}
                  {round.status === 'IN_PROGRESS' && (
                    <button
                      className="button secondary-button"
                      type="button"
                      onClick={() => handleComplete(round)}
                    >
                      Complete Round
                    </button>
                  )}
                  <Link
                    className="button primary-button"
                    to={`/organizer/tournaments/${tournamentId}/rounds/${round.id}/groups`}
                  >
                    Groups & Assignments
                  </Link>
                  <Link
                    className="button ghost-button"
                    to={`/organizer/tournaments/${tournamentId}/rounds/${round.id}/qualifications`}
                  >
                    Qualification Center
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
