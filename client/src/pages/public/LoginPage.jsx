import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { resolveInitialWorkspaceRoute } from '../../utils/workspaceRouting.js';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
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
      const identity = await login(form);
      const destination = resolveInitialWorkspaceRoute(identity);
      navigate(destination);
    } catch (error) {
      setState({ loading: false, error: error.message, fields: error.details?.body || {} });
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-intro">
        <div className="page-kicker">Account access</div>
        <h1>Login</h1>
        <p>Enter your EVOQ account details to continue to your tournament workspace.</p>
      </div>
      <form className="auth-form" onSubmit={submit} noValidate>
        {state.error && <div className="form-alert" role="alert">{state.error}</div>}
        <label htmlFor="login-email">Email</label>
        <input id="login-email" name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} aria-invalid={Boolean(state.fields.email)} />
        {state.fields.email && <span className="field-error">{state.fields.email}</span>}
        <label htmlFor="login-password">Password</label>
        <input id="login-password" name="password" type="password" autoComplete="current-password" value={form.password} onChange={updateField} aria-invalid={Boolean(state.fields.password)} />
        {state.fields.password && <span className="field-error">{state.fields.password}</span>}
        <button className="button primary-button" type="submit" disabled={state.loading}>{state.loading ? 'Signing in...' : 'Login'}</button>
        <p className="form-footnote">New to EVOQ? <Link to="/signup">Create an account</Link></p>
      </form>
    </section>
  );
}
