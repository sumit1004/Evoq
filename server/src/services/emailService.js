import { Resend } from 'resend';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

let resendClient = null;

function getResendClient() {
  if (!resendClient && config.resendApiKey) {
    resendClient = new Resend(config.resendApiKey);
  }
  return resendClient;
}

function buildPasswordResetHtml({ name, resetUrl, expiresMinutes }) {
  const safeName = name ? String(name).replace(/[<>&"]/g, '') : 'Player';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - EVOQ Gaming</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b0f19; width: 100%; min-height: 100vh; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 580px; background-color: #131b2e; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header / Brand -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #1e293b; background: linear-gradient(180deg, #1e293b 0%, #131b2e 100%);">
              <div style="font-size: 24px; font-weight: 900; letter-spacing: 2px; color: #38bdf8; text-transform: uppercase;">
                EVOQ<span style="color: #f8fafc; margin-left: 4px;">GAMING</span>
              </div>
              <div style="font-size: 12px; font-weight: 600; letter-spacing: 1.5px; color: #94a3b8; text-transform: uppercase; margin-top: 4px;">
                Esports Tournament Platform
              </div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 32px;">
              <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #f8fafc; text-align: left;">
                Password Reset Request
              </h1>
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
                Hello <strong>${safeName}</strong>,
              </p>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
                We received a request to reset the password for your EVOQ Gaming account. Click the button below to choose a new password:
              </p>

              <!-- Action Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 32px auto; text-align: center;">
                <tr>
                  <td style="border-radius: 8px; background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%);">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px; letter-spacing: 0.5px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry Note -->
              <div style="margin: 28px 0 20px; padding: 16px; background-color: #0f172a; border-left: 4px solid #38bdf8; border-radius: 4px;">
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #94a3b8;">
                  This link will expire in <strong>${expiresMinutes} minutes</strong>. If you did not request this reset, you can safely ignore this email and your password will remain unchanged.
                </p>
              </div>

              <!-- Fallback Link -->
              <p style="margin: 24px 0 8px; font-size: 13px; line-height: 1.5; color: #64748b;">
                If the button above does not work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 1.4; word-break: break-all; color: #38bdf8;">
                <a href="${resetUrl}" style="color: #38bdf8; text-decoration: underline;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #0b0f19; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                &copy; ${new Date().getFullYear()} EVOQ Gaming. All rights reserved.<br>
                This is an automated security email. Please do not reply directly.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export async function sendPasswordResetEmail({ to, name, resetUrl, expiresMinutes = 30 }) {
  const client = getResendClient();
  const html = buildPasswordResetHtml({ name, resetUrl, expiresMinutes });
  const subject = 'Reset Your Password - EVOQ Gaming';

  if (!client) {
    logger.info('password_reset_email_simulated', {
      to,
      name,
      resetUrl,
      reason: 'RESEND_API_KEY_not_configured',
    });
    return { id: 'simulated-dev-id', simulated: true };
  }

  try {
    const result = await client.emails.send({
      from: config.emailFrom,
      to,
      subject,
      html,
    });

    if (result.error) {
      logger.error('resend_email_failed', {
        to,
        error: result.error,
      });
      throw new Error(result.error.message || 'Failed to send password reset email via Resend');
    }

    logger.info('password_reset_email_sent', {
      to,
      emailId: result.data?.id,
    });

    return result.data;
  } catch (error) {
    logger.error('email_service_send_error', {
      to,
      error: error.message,
    });
    throw error;
  }
}
