import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { fetchTeams } from '../../services/teamApi.js';
import { fetchRegistrations, fetchTournament, registerTeam } from '../../services/tournamentApi.js';

export function TournamentDetailsPage() {
  const { tournamentId } = useParams();
  const { identity } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [form, setForm] = useState({ teamId: '', transactionId: '', paymentScreenshot: null });
  const [state, setState] = useState({ loading: true, submitting: false, error: '', notice: '' });

  const load = useCallback(async () => {
    try {
      const result = await fetchTournament(tournamentId);
      setTournament(result.tournament);
      if (identity?.role === 'PLAYER') {
        const [teamResult, registrationResult] = await Promise.all([fetchTeams(), fetchRegistrations(tournamentId)]);
        setTeams(Array.isArray(teamResult) ? teamResult : teamResult?.teams || []);
        setRegistrations(Array.isArray(registrationResult?.registrations) ? registrationResult.registrations : []);
      }
      setState((current) => ({ ...current, loading: false }));
    } catch (error) { setState({ loading: false, submitting: false, error: error.message, notice: '' }); }
  }, [tournamentId, identity?.role]);
  useEffect(() => { load(); }, [load]);

  async function submit(event) {
    event.preventDefault();
    setState((current) => ({ ...current, submitting: true, error: '', notice: '' }));
    try {
      await registerTeam(tournamentId, form);
      setForm({ teamId: '', transactionId: '', paymentScreenshot: null });
      setState((current) => ({ ...current, submitting: false, notice: 'Registration submitted for organizer review.' }));
      const result = await fetchRegistrations(tournamentId);
      setRegistrations(Array.isArray(result?.registrations) ? result.registrations : []);
    } catch (error) { setState((current) => ({ ...current, submitting: false, error: error.message })); }
  }

  if (state.loading) return <section className="page-section"><p className="status-panel">Loading tournament...</p></section>;
  if (!tournament) return <section className="page-section"><div className="form-alert" role="alert">{state.error || 'Tournament details are unavailable.'}</div></section>;
  return (
    <section className="page-section workspace-page">
      <Link className="text-link" to="/tournaments">Back to tournaments</Link>
      <div className="page-kicker">{tournament.status.replaceAll('_', ' ')}</div>
      <h1>{tournament.name}</h1>
      <p>{tournament.description || 'No description provided.'}</p>
      <div className="detail-grid">
        <div className="detail-panel"><strong>Registration</strong><span>{new Date(tournament.registrationStartAt).toLocaleString()} to {new Date(tournament.registrationEndAt).toLocaleString()}</span></div>
        <div className="detail-panel"><strong>Format</strong><span>{tournament.playersPerTeam} players per team · {tournament.maxTeams} teams</span></div>
        <div className="detail-panel"><strong>Entry</strong><span>{tournament.entryType === 'PAID' ? tournament.entryFee : 'Free'}</span></div>
      </div>
      {identity?.role === 'PLAYER' && tournament.status === 'REGISTRATION_OPEN' && (
        <form className="registration-form" onSubmit={submit}>
          <h2>Register a team</h2>
          {state.error && <div className="form-alert" role="alert">{state.error}</div>}
          {state.notice && <div className="success-alert" role="status">{state.notice}</div>}
          <label htmlFor="registration-team">Team</label>
          <select id="registration-team" value={form.teamId} onChange={(event) => setForm((current) => ({ ...current, teamId: event.target.value }))} required>
            <option value="">Choose a team</option>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name} ({team.members.length} players)</option>)}
          </select>
          {tournament.entryType === 'PAID' && <>
            <label htmlFor="registration-transaction">Transaction ID</label>
            <input id="registration-transaction" value={form.transactionId} onChange={(event) => setForm((current) => ({ ...current, transactionId: event.target.value }))} required />
            <label htmlFor="registration-proof">Payment screenshot</label>
            <input id="registration-proof" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setForm((current) => ({ ...current, paymentScreenshot: event.target.files?.[0] || null }))} required />
          </>}
          <button className="button primary-button" type="submit" disabled={state.submitting}>{state.submitting ? 'Submitting...' : 'Submit registration'}</button>
        </form>
      )}
      {identity?.role === 'PLAYER' && registrations.length > 0 && <div className="registration-list"><h2>Your registrations</h2>{registrations.map((registration) => <div className="registration-item" key={registration.id}><strong>{registration.teamName}</strong><span className={`status-badge ${registration.status.toLowerCase()}`}>{registration.status}</span>{registration.rejectionReason && <p>{registration.rejectionReason}</p>}</div>)}</div>}
      {!identity && <p className="status-panel">Login as a player to register an eligible team.</p>}
    </section>
  );
}
