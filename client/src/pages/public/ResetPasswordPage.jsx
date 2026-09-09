import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { resetPasswordApi, validateResetTokenApi } from '../../services/authApi.js';

export function ResetPasswordPage() {
  const { token } = useParams();

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [validationError, setValidationError] = useState('');

  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    let active = true;

    async function checkToken() {
      if (!token) {
        if (active) {
          setValidating(false);
          setTokenValid(false);
          setValidationError('Missing password reset token in URL.');
        }
        return;
      }

      setValidating(true);
      try {
        const response = await validateResetTokenApi(token);
        if (active) {
          setTokenValid(true);
          setMaskedEmail(response.email || '');
        }
      } catch (err) {
        if (active) {
          setTokenValid(false);
          setValidationError(
            err.message || 'This password reset link is invalid, expired, or has already been used.',
          );
        }
      } finally {
        if (active) {
          setValidating(false);
        }
      }
    }

    checkToken();

    return () => {
      active = false;
    };
  }, [token]);

  function handleFieldChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: '' }));
    setSubmitError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError('');
    const errors = {};

    if (!form.newPassword || form.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters long';
    }
    if (form.newPassword !== form.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      await resetPasswordApi({
        token,
        newPassword: form.newPassword,
      });
      setSubmitSuccess(true);
    } catch (err) {
      setSubmitError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-intro">
        <div className="page-kicker">Security</div>
        <h1>Reset Password</h1>
        <p>
          Choose a secure new password for your EVOQ Gaming tournament platform account.
        </p>
      </div>

      <div className="auth-form">
        {validating ? (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <p style={{ color: '#94a3b8' }}>Verifying your security token...</p>
          </div>
        ) : submitSuccess ? (
          <div className="reset-success-container">
            <div className="form-success" role="status">
              Your password has been reset successfully! You can now log in using your new password.
            </div>
            <div style={{ marginTop: '24px' }}>
              <Link
                to="/login"
                className="button primary-button"
                style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
              >
                Proceed to Login
              </Link>
            </div>
          </div>
        ) : !tokenValid ? (
          <div className="token-invalid-container">
            <div className="form-alert" role="alert">
              {validationError || 'This password reset link is invalid or has expired.'}
            </div>
            <p style={{ marginTop: '16px', fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.6' }}>
              Password reset links expire after 30 minutes and can only be used once for security reasons.
            </p>
            <div style={{ marginTop: '20px' }}>
              <Link
                to="/forgot-password"
                className="button primary-button"
                style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
              >
                Request New Reset Link
              </Link>
            </div>
            <p className="form-footnote" style={{ marginTop: '16px' }}>
              <Link to="/login">Back to login</Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {maskedEmail && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '10px 14px',
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(205, 214, 226, 0.15)',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  color: '#94a3b8',
                }}
              >
                Account: <strong style={{ color: '#e2e8f0' }}>{maskedEmail}</strong>
              </div>
            )}

            {submitError && (
              <div className="form-alert" role="alert" style={{ marginBottom: '16px' }}>
                {submitError}
              </div>
            )}

            <label htmlFor="reset-new-password">New Password</label>
            <input
              id="reset-new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Minimum 8 characters"
              value={form.newPassword}
              onChange={handleFieldChange}
              aria-invalid={Boolean(fieldErrors.newPassword)}
              disabled={submitting}
              required
            />
            {fieldErrors.newPassword && <span className="field-error">{fieldErrors.newPassword}</span>}

            <label htmlFor="reset-confirm-password" style={{ marginTop: '12px' }}>
              Confirm New Password
            </label>
            <input
              id="reset-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={form.confirmPassword}
              onChange={handleFieldChange}
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              disabled={submitting}
              required
            />
            {fieldErrors.confirmPassword && (
              <span className="field-error">{fieldErrors.confirmPassword}</span>
            )}

            <div style={{ marginTop: '20px' }}>
              <button
                className="button primary-button"
                type="submit"
                disabled={submitting}
                style={{ width: '100%' }}
              >
                {submitting ? 'Updating Password...' : 'Update Password'}
              </button>
            </div>

            <p className="form-footnote" style={{ marginTop: '16px' }}>
              <Link to="/login">Cancel and return to login</Link>
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
