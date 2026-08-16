import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

const initialForm = { name: '', email: '', password: '', role: 'PLAYER', mobile: '', inGameName: '', gameUid: '' };

export function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [state, setState] = useState({ loading: false, error: '', fields: {} });

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setState((current) => ({ ...current, error: '', fields: { ...current.fields, [name]: '' } }));
  }

  async function submit(event) {
    event.preventDefault();
    setState({ loading: true, error: '', fields: {} });
    try {
      const identity = await signup(form);
      navigate(identity.role === 'ORGANIZER' ? '/organizer' : '/player');
    } catch (error) {
      setState({ loading: false, error: error.message, fields: error.details?.body || {} });
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-intro">
        <div className="page-kicker">Create account</div>
        <h1>Signup</h1>
        <p>Create a player account or organizer workspace. Player identity details can be completed now or later.</p>
      </div>
      <form className="auth-form" onSubmit={submit} noValidate>
        {state.error && <div className="form-alert" role="alert">{state.error}</div>}
        <label htmlFor="signup-name">Name</label>
        <input id="signup-name" name="name" autoComplete="name" value={form.name} onChange={updateField} aria-invalid={Boolean(state.fields.name)} />
        {state.fields.name && <span className="field-error">{state.fields.name}</span>}
        <label htmlFor="signup-email">Email</label>
        <input id="signup-email" name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} aria-invalid={Boolean(state.fields.email)} />
        {state.fields.email && <span className="field-error">{state.fields.email}</span>}
        <label htmlFor="signup-password">Password</label>
        <input id="signup-password" name="password" type="password" autoComplete="new-password" value={form.password} onChange={updateField} aria-invalid={Boolean(state.fields.password)} />
        {state.fields.password && <span className="field-error">{state.fields.password}</span>}
        <label htmlFor="signup-role">Account type</label>
        <select id="signup-role" name="role" value={form.role} onChange={updateField}>
          <option value="PLAYER">Player</option>
          <option value="ORGANIZER">Organizer</option>
        </select>
        {form.role === 'PLAYER' && (
          <div className="optional-fields">
            <label htmlFor="signup-mobile">Mobile <span>(optional)</span></label>
            <input id="signup-mobile" name="mobile" type="tel" autoComplete="tel" value={form.mobile} onChange={updateField} />
            <label htmlFor="signup-ign">In-game name <span>(optional)</span></label>
            <input id="signup-ign" name="inGameName" value={form.inGameName} onChange={updateField} />
            <label htmlFor="signup-game-uid">Game UID <span>(optional)</span></label>
            <input id="signup-game-uid" name="gameUid" value={form.gameUid} onChange={updateField} />
          </div>
        )}
        <button className="button primary-button" type="submit" disabled={state.loading}>{state.loading ? 'Creating account...' : 'Create account'}</button>
        <p className="form-footnote">Already registered? <Link to="/login">Login</Link></p>
      </form>
    </section>
  );
}
