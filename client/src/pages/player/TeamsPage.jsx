import { useEffect, useState } from 'react';
import { createTeam, fetchTeams, removeTeam } from '../../services/teamApi.js';
import { useAuth } from '../../context/AuthContext.jsx';

const initialForm = { name: '', memberPlayerIds: '' };

export function TeamsPage() {
  const { identity } = useAuth();
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [state, setState] = useState({ loading: true, submitting: false, error: '', fields: {}, notice: '' });

  async function loadTeams() {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      setTeams(await fetchTeams());
      setState((current) => ({ ...current, loading: false }));
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }

  useEffect(() => { loadTeams(); }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setState((current) => ({ ...current, error: '', notice: '', fields: { ...current.fields, [name]: '' } }));
  }

  async function submit(event) {
    event.preventDefault();
    const memberPlayerIds = form.memberPlayerIds.split(/[\n,]/).map((id) => id.trim()).filter(Boolean);
    const validation = {};
    if (form.name.trim().length < 2) validation.name = 'Team name must be between 2 and 120 characters';
    const normalizedIds = memberPlayerIds.map((id) => id.toUpperCase());
    if (new Set(normalizedIds).size !== normalizedIds.length) validation.memberPlayerIds = 'Player IDs must be unique';
    if (Object.keys(validation).length > 0) {
      setState((current) => ({ ...current, error: 'Please correct the highlighted fields.', fields: validation }));
      return;
    }
    setState((current) => ({ ...current, submitting: true, error: '', notice: '', fields: {} }));
    try {
      const team = await createTeam({ name: form.name, memberPlayerIds });
      setTeams((current) => [team, ...current]);
      setForm(initialForm);
      setState((current) => ({ ...current, submitting: false, notice: `${team.name} was created.` }));
    } catch (error) {
      setState((current) => ({ ...current, submitting: false, error: error.message, fields: error.details?.body || {} }));
    }
  }

  async function deleteTeam(team) {
    if (team.ownerId !== identity.id || !window.confirm(`Delete ${team.name}?`)) return;
    try {
      await removeTeam(team.id);
      setTeams((current) => current.filter((item) => item.id !== team.id));
      setState((current) => ({ ...current, notice: `${team.name} was deleted.`, error: '' }));
    } catch (error) {
      setState((current) => ({ ...current, error: error.message, notice: '' }));
    }
  }

  return (
    <section className="workspace-page">
      <div className="page-kicker">Team management</div>
      <h1>Your teams</h1>
      <p>Create reusable teams from registered EVOQ player IDs. Teams can be selected for tournaments later.</p>
      {state.error && <div className="form-alert" role="alert">{state.error}</div>}
      {state.notice && <div className="success-alert" role="status">{state.notice}</div>}
      <div className="teams-layout">
        <form className="team-form" onSubmit={submit} noValidate>
          <h2>Create a team</h2>
          <label htmlFor="team-name">Team name</label>
          <input id="team-name" name="name" value={form.name} onChange={updateField} aria-invalid={Boolean(state.fields.name)} />
          {state.fields.name && <span className="field-error">{state.fields.name}</span>}
          <label htmlFor="team-members">Member player IDs <span>(optional, one per line)</span></label>
          <textarea id="team-members" name="memberPlayerIds" rows="5" value={form.memberPlayerIds} onChange={updateField} aria-invalid={Boolean(state.fields.memberPlayerIds)} />
          {state.fields.memberPlayerIds && <span className="field-error">{state.fields.memberPlayerIds}</span>}
          <button className="button primary-button" type="submit" disabled={state.submitting}>{state.submitting ? 'Creating team...' : 'Create team'}</button>
        </form>
        <div className="team-list" aria-live="polite">
          <h2>Existing teams</h2>
          {state.loading && <p className="status-panel">Loading teams...</p>}
          {!state.loading && teams.length === 0 && <p className="empty-state">No teams created yet.</p>}
          {!state.loading && teams.map((team) => (
            <article className="team-item" key={team.id}>
              <div>
                <h3>{team.name}</h3>
                <p>{team.members.length} member{team.members.length === 1 ? '' : 's'}</p>
                <ul>{team.members.map((member) => <li key={member.id}>{member.name} <span>{member.uniquePlayerId}</span></li>)}</ul>
              </div>
              {team.ownerId === identity.id && <button className="text-button danger-text" type="button" onClick={() => deleteTeam(team)}>Delete</button>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
