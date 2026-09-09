import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordResetApi } from '../../services/authApi.js';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');

  function handleEmailChange(event) {
    setEmail(event.target.value);
    setError('');
    setFieldError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setFieldError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setFieldError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await requestPasswordResetApi(trimmedEmail);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Unable to process your request. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-intro">
        <div className="page-kicker">Account recovery</div>
        <h1>Forgot Password</h1>
        <p>
          Enter the email address associated with your EVOQ Gaming account to receive a secure password reset link.
        </p>
      </div>

      <div className="auth-form">
        {submitted ? (
          <div className="reset-success-container">
            <div className="form-success" role="status">
              If an account exists for <strong>{email}</strong>, a secure password reset link has been dispatched.
              Please check your inbox and spam folders. The reset link is valid for 30 minutes.
            </div>

            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                type="button"
                className="button ghost-button"
                onClick={() => {
                  setSubmitted(false);
                  setEmail('');
                }}
              >
                Send another reset link
              </button>
              <p className="form-footnote">
                Remember your password? <Link to="/login">Return to login</Link>
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="form-alert" role="alert" style={{ marginBottom: '12px' }}>
                {error}
              </div>
            )}

            <label htmlFor="forgot-email">Account Email</label>
            <input
              id="forgot-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="e.g. player@evoqgaming.com"
              value={email}
              onChange={handleEmailChange}
              aria-invalid={Boolean(fieldError)}
              disabled={loading}
              required
            />
            {fieldError && <span className="field-error">{fieldError}</span>}

            <div style={{ marginTop: '16px' }}>
              <button
                className="button primary-button"
                type="submit"
                disabled={loading}
                style={{ width: '100%' }}
              >
                {loading ? 'Sending reset link...' : 'Send Reset Link'}
              </button>
            </div>

            <p className="form-footnote" style={{ marginTop: '16px' }}>
              Remember your password? <Link to="/login">Return to login</Link>
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
