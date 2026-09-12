# EVOQ Transactional Email Provider Architecture (Brevo v3)

**Platform:** EVOQ Esports Tournament SaaS  
**Email Provider:** Brevo (formerly Sendinblue) Transactional API v3  
**Status:** Active Production Email Engine  

---

## 1. Overview & Architecture

EVOQ utilizes Brevo's REST API v3 (`https://api.brevo.com/v3/smtp/email`) as the sole transactional email provider for password resets and security notifications.

The email engine is structured with a decoupled, provider-agnostic service layer:

```
+-------------------------------------------------------------------+
|               EVOQ Authentication & Identity Layer                |
|           (Player / Organizer / Scout Password Reset)             |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                 PasswordResetService (Business Logic)             |
|   - Cryptographic raw token generation (crypto.randomBytes(32))   |
|   - SHA-256 token hashing for database storage                   |
|   - Anti-enumeration & timing attack protection                   |
|   - Multi-token invalidation on re-request                        |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                     EmailService (Service Interface)              |
|   - Email template compilation & HTML escaping (XSS defense)      |
|   - Environment policy enforcement (Prod vs Dev)                  |
|   - Structured audit logging                                      |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                 BrevoEmailProvider (API Integration)              |
|   - Direct HTTPS POST /v3/smtp/email with timeout & AbortSignal  |
|   - Strict Header authorization: `api-key: ${BREVO_API_KEY}`     |
|   - Error classification into standard operational categories     |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                        Brevo API v3 Gateway                       |
+-------------------------------------------------------------------+
```

---

## 2. Environment Configuration

### Required Server Environment Variables

| Variable | Scope | Description | Example / Format |
|---|---|---|---|
| `BREVO_API_KEY` | Server-Only | Brevo API v3 transactional secret key | `xkeysib-xxxxxxxxxxxxxxxx` |
| `EMAIL_FROM` | Server-Only | Verified sender identity | `EVOQ Gaming <no-reply@evoqgaming.com>` |
| `EMAIL_FROM_NAME` | Server-Only | Default sender display name | `EVOQ Gaming` |
| `APP_URL` | Server-Only | Canonical base application URL for reset links | `https://evoqgaming.com` |

> [!CAUTION]
> **Strict Security Rules:**
> - `BREVO_API_KEY` must NEVER be prefixed with `VITE_` or included in frontend client builds.
> - `BREVO_API_KEY` must NEVER be returned by any API endpoint or printed in logs.
> - All password-reset tokens are hashed (SHA-256) before database storage; raw tokens only exist in memory during dispatch.

---

## 3. Local Development vs. Production Setup

### Local Development (`NODE_ENV=development`)
1. Create a `server/.env` file from `server/.env.example`.
2. Configure `APP_URL=http://localhost:5173`.
3. If `BREVO_API_KEY` is omitted, the service operates in explicit safe simulation mode:
   - Logs structured `password_reset_email_simulated` event.
   - Raw tokens are NEVER logged to console or logs.
   - Returns simulated message ID for UI workflow testing.
4. To test real email delivery locally, populate `BREVO_API_KEY` with a valid Brevo v3 key and set `EMAIL_FROM` to an address verified on your Brevo account.

### Production Environment (`NODE_ENV=production`)
1. In production, startup assertion in `server/src/config/env.js` ensures that `BREVO_API_KEY`, `EMAIL_FROM`, and `APP_URL` are strictly defined.
2. If `BREVO_API_KEY` is missing at runtime, email operations fail immediately with `EMAIL_CONFIGURATION_ERROR` and log structured failure events.

---

## 4. Brevo Sender & Custom Domain Verification

For production deliverability and inbox reputation, configure your custom domain (`evoqgaming.com`) in the Brevo Dashboard:

### Step 1: Add Senders in Brevo
1. Go to **Brevo Dashboard > Senders & IP > Senders**.
2. Add sender email (e.g. `no-reply@evoqgaming.com`) with name `EVOQ Gaming`.
3. Complete the verification confirmation email or verify the entire domain.

### Step 2: Domain Authentication (DNS Records)
Under **Brevo Dashboard > Senders & IP > Domains**, add `evoqgaming.com` and add the following DNS records to your DNS provider (Cloudflare / Route53):

| Type | Host / Name | Value / Target | Purpose |
|---|---|---|---|
| **TXT** | `evoqgaming.com` | `v=spf1 include:spf.brevo.com ~all` | SPF Verification |
| **TXT** | `mail._domainkey.evoqgaming.com` | `k=rsa; p=MIGf...` *(provided by Brevo)* | DKIM Signing |
| **TXT** | `_dmarc.evoqgaming.com` | `v=DMARC1; p=reject; rua=mailto:dmarc@evoqgaming.com` | DMARC Policy |

---

## 5. Password Reset Flow & Security Architecture

1. **User Request:** User submits email on `/forgot-password`.
2. **Anti-Enumeration Response:** Backend immediately prepares a generic response:  
   `"If an account matches that email address, a password reset link has been sent."` (Identical timing and response regardless of user existence).
3. **Token Generation:** If user exists:
   - Previous active tokens for this user are invalidated (`used_at = NOW()`).
   - 32-byte cryptographic random token generated (`crypto.randomBytes(32).toString('hex')`).
   - SHA-256 hash computed and stored in `password_reset_tokens` with 30-minute expiration.
   - Raw token is placed in `resetUrl: ${APP_URL}/reset-password/${rawToken}`.
4. **Dispatch:** `BrevoEmailProvider.send()` posts payload to Brevo API.
5. **Password Update:**
   - User submits new password on `/reset-password/:token`.
   - Backend queries `password_reset_tokens` matching SHA-256 hash, ensuring `used_at IS NULL` and `expires_at > NOW()`.
   - On success, `users.password_hash` is updated with bcrypt (cost 12), `users.token_version` is incremented (revoking all active JWT sessions), and the reset token is marked used.

---

## 6. Error Handling & Operational Classification

Brevo errors are mapped to standardized categories:

| Error Category | HTTP Code / Trigger | Operational Remediation |
|---|---|---|
| `EMAIL_CONFIGURATION_ERROR` | 401, 403, unverified sender | Check `BREVO_API_KEY` validity or verify sender domain in Brevo dashboard. |
| `EMAIL_VALIDATION_ERROR` | 400, 422 (malformed email) | User entered an invalid recipient format. |
| `EMAIL_RATE_LIMITED` | 429 | Brevo hourly/daily sending quota exceeded. |
| `EMAIL_PROVIDER_TIMEOUT` | Timeout / Network Abort (10s) | Brevo API latency or connectivity drop. Request safely logged. |
| `EMAIL_PROVIDER_ERROR` | 500, 502, 503 | Downstream Brevo infrastructure disruption. |

---

## 7. Key Rotation Procedure

To rotate your `BREVO_API_KEY` with zero downtime:
1. Log into **Brevo Dashboard > SMTP & API > API Keys**.
2. Click **Generate a new API key** (e.g. name: `evoq-production-2026`).
3. Update `BREVO_API_KEY` in production secrets manager (e.g., AWS Secrets Manager, Doppler, or Kubernetes secrets).
4. Perform rolling restart of the server instances.
5. Once verified with a test reset dispatch, delete the old API key in the Brevo Dashboard.
