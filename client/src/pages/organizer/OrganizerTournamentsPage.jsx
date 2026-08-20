import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createTournament, fetchOrganizerTournaments } from '../../services/tournamentApi.js';

const initialForm = {
  name: '',
  description: '',
  tournamentDate: '',
  registrationStartAt: '',
  registrationEndAt: '',
  maxTeams: 10,
  playersPerTeam: 4,
  entryType: 'FREE',
  entryFee: 0,
  paymentMethod: '',
  upiId: '',
  paymentQr: null,
  paymentInstructions: ''
};

export function OrganizerTournamentsPage() {
  const [tournaments, setTournaments] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [state, setState] = useState({ loading: true, submitting: false, error: '', notice: '' });

  async function load() {
    try {
      const result = await fetchOrganizerTournaments();
      setTournaments(result.tournaments);
      setState((current) => ({ ...current, loading: false }));
    } catch (error) {
      setState({ loading: false, submitting: false, error: error.message, notice: '' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  function update(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setState((current) => ({ ...current, submitting: true, error: '', notice: '' }));
    try {
      const payload = {
        ...form,
        maxTeams: Number(form.maxTeams),
        playersPerTeam: Number(form.playersPerTeam),
        entryFee: form.entryType === 'FREE' ? 0 : Number(form.entryFee)
      };
      
      const result = await createTournament(payload);
      setTournaments((current) => [result.tournament, ...current]);
      setForm(initialForm);
      setState({ loading: false, submitting: false, error: '', notice: 'Tournament created as draft.' });
    } catch (error) {
      setState((current) => ({ ...current, submitting: false, error: error.message }));
    }
  }

  return (
    <section className="workspace-page">
      <div className="page-kicker">Tournament management</div>
      <h1>Your tournaments</h1>
      <p>Draft and operate tournaments from one organizer-owned workspace.</p>
      {state.error && <div className="form-alert" role="alert">{state.error}</div>}
      {state.notice && <div className="success-alert" role="status">{state.notice}</div>}
      <div className="organizer-grid">
        <form className="team-form" onSubmit={submit}>
          <h2>Create tournament</h2>
          <label htmlFor="tournament-name">Name</label>
          <input id="tournament-name" name="name" value={form.name} onChange={update} required />

          <label htmlFor="tournament-description">Description</label>
          <textarea id="tournament-description" name="description" rows="3" value={form.description} onChange={update} />

          <label htmlFor="tournament-date">Tournament date</label>
          <input id="tournament-date" name="tournamentDate" type="datetime-local" value={form.tournamentDate} onChange={update} />

          <label htmlFor="registration-start">Registration starts</label>
          <input id="registration-start" name="registrationStartAt" type="datetime-local" value={form.registrationStartAt} onChange={update} required />

          <label htmlFor="registration-end">Registration ends</label>
          <input id="registration-end" name="registrationEndAt" type="datetime-local" value={form.registrationEndAt} onChange={update} required />

          <div className="form-two-col">
            <label>Max teams
              <input name="maxTeams" type="number" min="1" value={form.maxTeams} onChange={update} />
            </label>
            <label>Players/team
              <input name="playersPerTeam" type="number" min="1" value={form.playersPerTeam} onChange={update} />
            </label>
          </div>

          <label htmlFor="entry-type">Entry type</label>
          <select id="entry-type" name="entryType" value={form.entryType} onChange={update}>
            <option value="FREE">Free</option>
            <option value="PAID">Paid</option>
          </select>

          {form.entryType === 'PAID' && (
            <>
              <label htmlFor="entry-fee">Entry fee (₹)</label>
              <input id="entry-fee" name="entryFee" type="number" min="0.01" step="0.01" value={form.entryFee} onChange={update} required />

              <label htmlFor="payment-method">Payment method</label>
              <select id="payment-method" name="paymentMethod" value={form.paymentMethod} onChange={update} required>
                <option value="">Choose method</option>
                <option value="MANUAL_UPI">Manual UPI</option>
                <option value="ONLINE">Online Payment</option>
              </select>

              {form.paymentMethod === 'MANUAL_UPI' && (
                <>
                  <label htmlFor="upi-id">UPI ID</label>
                  <input id="upi-id" name="upiId" placeholder="e.g. organizer@upi" value={form.upiId} onChange={update} required />

                  <label htmlFor="payment-qr">QR Code Image</label>
                  <input id="payment-qr" name="paymentQr" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setForm(f => ({ ...f, paymentQr: e.target.files?.[0] || null }))} />
                </>
              )}

              {form.paymentMethod === 'ONLINE' && (
                <div style={{ padding: '10px', background: 'rgba(255,0,0,0.1)', border: '1px solid red', borderRadius: '4px', margin: '10px 0' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Payment account not connected.</p>
                  <button className="button secondary-button" style={{ minHeight: '44px' }} type="button" onClick={() => window.alert('Online integration is currently set as unconfigured. Connect account is simulated.')}>Connect Payment Account</button>
                </div>
              )}

              <label htmlFor="payment-instructions">Payment instructions</label>
              <textarea id="payment-instructions" name="paymentInstructions" rows="3" value={form.paymentInstructions} onChange={update} />
            </>
          )}

          <button className="button primary-button" type="submit" disabled={state.submitting}>
            {state.submitting ? 'Creating...' : 'Create draft'}
          </button>
        </form>

        <div className="team-list">
          <h2>Existing tournaments</h2>
          {state.loading && <p className="status-panel">Loading tournaments...</p>}
          {!state.loading && tournaments.length === 0 && <p className="empty-state">No tournaments created yet.</p>}
          {tournaments.map((tournament) => (
            <Link className="tournament-item compact" to={`/organizer/tournaments/${tournament.id}`} key={tournament.id}>
              <span className="tournament-status">{tournament.status.replaceAll('_', ' ')}</span>
              <h3>{tournament.name}</h3>
              <p>{tournament.maxTeams} teams · {tournament.playersPerTeam} players per team</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
