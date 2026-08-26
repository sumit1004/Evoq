import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  createResult,
  fetchGroup,
  fetchMatch,
  fetchMatchLeaderboard,
  fetchResults,
  recalculateLeaderboard
} from '../../services/competitionApi.js';

export function OrganizerMatchResultsPage() {
  const { tournamentId, matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [teams, setTeams] = useState([]);
  const [results, setResults] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [form, setForm] = useState({
    teamId: '',
    points: 0,
    kills: 0,
    placement: '',
    resultText: '',
    resultMedia: null
  });
  const [fileKey, setFileKey] = useState(Date.now());
  const [state, setState] = useState({ loading: true, submitting: false, error: '', notice: '' });

  const load = useCallback(async () => {
    try {
      const matchResult = await fetchMatch(matchId);
      const [groupResult, resultResult, leaderboardResult] = await Promise.all([
        fetchGroup(matchResult.match.groupId),
        fetchResults(matchId),
        fetchMatchLeaderboard(matchId)
      ]);
      setMatch(matchResult.match);
      setTeams(groupResult.group?.teams || []);
      setResults(resultResult.results || []);
      setLeaderboard(leaderboardResult.leaderboard || []);
      setState((s) => ({ ...s, loading: false, submitting: false }));
    } catch (error) {
      setState({ loading: false, submitting: false, error: error.message || 'Failed to load match details.', notice: '' });
    }
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(event) {
    event.preventDefault();
    if (!form.teamId) {
      setState((s) => ({ ...s, error: 'Please select a team before submitting.', notice: '' }));
      return;
    }
    setState((s) => ({ ...s, submitting: true, error: '', notice: '' }));
    try {
      const result = await createResult(matchId, form);
      setResults((current) => [...current, result.result]);
      setForm({ teamId: '', points: 0, kills: 0, placement: '', resultText: '', resultMedia: null });
      setFileKey(Date.now());
      setState({ loading: false, submitting: false, error: '', notice: `Result recorded for ${result.result.teamName}. You can now recalculate the leaderboard.` });
    } catch (error) {
      let errorMessage = error.message;
      if (error.details?.body) {
        errorMessage = Object.values(error.details.body).join(' · ');
      } else if (error.details && typeof error.details === 'object') {
        errorMessage = Object.values(error.details).join(' · ');
      }
      setState((s) => ({ ...s, submitting: false, error: errorMessage || 'Failed to save result.', notice: '' }));
    }
  }

  async function recalculate() {
    setState((s) => ({ ...s, submitting: true, error: '', notice: '' }));
    try {
      const result = await recalculateLeaderboard(matchId);
      setLeaderboard(result.leaderboard || []);
      setState({ loading: false, submitting: false, error: '', notice: 'Leaderboard recalculated successfully.' });
    } catch (error) {
      setState((s) => ({ ...s, submitting: false, error: error.message || 'Failed to recalculate leaderboard.' }));
    }
  }

  if (state.loading) {
    return (
      <section className="workspace-page">
        <p className="status-panel">Loading match results...</p>
      </section>
    );
  }

  const unassignedTeams = teams.filter((team) => !results.some((result) => String(result.teamId) === String(team.id)));

  return (
    <section className="workspace-page">
      <Link className="text-link" to={`/organizer/tournaments/${tournamentId}/groups/${match?.groupId}`}>
        ← Back to group
      </Link>
      <div className="page-kicker">Results</div>
      <h1>{match?.name}</h1>
      <p>Record one independent result per team, then persist the match leaderboard.</p>

      {state.error && <div className="form-alert" role="alert">{state.error}</div>}
      {state.notice && <div className="success-alert" role="status">{state.notice}</div>}

      <div className="competition-layout">
        <form className="team-form" onSubmit={submit}>
          <h2>Add result</h2>
          <label htmlFor="result-team">Team</label>
          <select
            id="result-team"
            value={form.teamId}
            onChange={(e) => setForm({ ...form, teamId: e.target.value })}
            disabled={state.submitting || match?.status === 'COMPLETED'}
            required
          >
            <option value="">Select assigned team</option>
            {unassignedTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>

          <label htmlFor="result-points">Points</label>
          <input
            id="result-points"
            type="number"
            min="0"
            step="0.01"
            value={form.points}
            onChange={(e) => setForm({ ...form, points: e.target.value })}
            disabled={state.submitting || match?.status === 'COMPLETED'}
            required
          />

          <label htmlFor="result-kills">Kills</label>
          <input
            id="result-kills"
            type="number"
            min="0"
            value={form.kills}
            onChange={(e) => setForm({ ...form, kills: e.target.value })}
            disabled={state.submitting || match?.status === 'COMPLETED'}
            required
          />

          <label htmlFor="result-placement">Placement <span>(optional)</span></label>
          <input
            id="result-placement"
            type="number"
            min="1"
            value={form.placement}
            onChange={(e) => setForm({ ...form, placement: e.target.value })}
            disabled={state.submitting || match?.status === 'COMPLETED'}
          />

          <label htmlFor="result-text">Notes <span>(optional)</span></label>
          <textarea
            id="result-text"
            rows="3"
            value={form.resultText}
            onChange={(e) => setForm({ ...form, resultText: e.target.value })}
            disabled={state.submitting || match?.status === 'COMPLETED'}
          />

          <label htmlFor="result-media">Screenshot <span>(optional, image)</span></label>
          <input
            key={fileKey}
            id="result-media"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setForm({ ...form, resultMedia: e.target.files?.[0] || null })}
            disabled={state.submitting || match?.status === 'COMPLETED'}
          />

          <button className="button primary-button" type="submit" disabled={state.submitting || match?.status === 'COMPLETED'}>
            {state.submitting ? 'Saving result...' : 'Save result'}
          </button>
        </form>

        <div className="team-list">
          <div className="section-heading">
            <h2>Leaderboard</h2>
            <button className="button secondary-button" type="button" onClick={recalculate} disabled={state.submitting || !results.length}>
              Recalculate
            </button>
          </div>
          {!leaderboard.length && <p className="empty-state">No leaderboard snapshot yet.</p>}
          {leaderboard.map((entry) => (
            <div className="competition-item" key={entry.teamId}>
              <div>
                <span className="tournament-status">Rank {entry.rank}</span>
                <h3>{entry.teamName}</h3>
              </div>
              <strong>{entry.points} pts · {entry.kills} kills</strong>
            </div>
          ))}

          <h2>Results entered ({results.length})</h2>
          {!results.length && <p className="empty-state">No results entered yet.</p>}
          {results.map((result) => (
            <div className="competition-item" key={result.id}>
              <div>
                <h3>{result.teamName}</h3>
                <p>
                  {result.points} points · {result.kills} kills
                  {result.placement ? ` · place ${result.placement}` : ''}
                </p>
              </div>
              <span>{result.hasMedia ? 'Media attached' : 'No media'}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

