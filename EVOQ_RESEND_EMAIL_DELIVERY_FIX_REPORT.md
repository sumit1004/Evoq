# EVOQ — RESEND EMAIL DELIVERY & PASSWORD RESET DIAGNOSTIC REPORT

**Document ID:** `EVOQ-RESEND-FIX-2026-09-12`  
**Platform:** EVOQ Esports Tournament SaaS  
**Evaluation Status:** **CONDITIONAL PASS — EXTERNAL RESEND CONFIGURATION REQUIRED**  
**Resend SDK Version:** `resend@6.26.0`  

---

## 1. Exact Symptom

Users attempting password reset via `POST /api/auth/forgot-password` experienced email delivery failures when using test player addresses or general email recipients. While the endpoint returned a 200 HTTP response for account enumeration defense, emails failed to dispatch to target mailboxes, and internal logs displayed 403 provider validation errors (`validation_error: You can only send testing emails to your own email address...`).

---

## 2. Reproduction Steps

1. Started EVOQ backend (`http://localhost:4000`) and client (`http://localhost:5173`).
2. Configured test environment with `EMAIL_FROM=EVOQ Gaming <onboarding@resend.dev>`.
3. Executed `POST /api/auth/forgot-password` with an arbitrary recipient (e.g. `testplayer@gmail.com`).
4. **Observed Behavior:**
   - Client received: `{ "message": "If an account matches that email address, a password reset link has been sent." }` (Status 200).
   - Resend API rejected dispatch with HTTP 403 `validation_error`.
   - Email was never dispatched to the mailbox.

---

## 3. Root Cause Analysis

1. **Resend Testing Sandbox Restriction (`onboarding@resend.dev`):**
   - The development environment uses the default Resend onboarding domain `resend.dev`.
   - By design, Resend strictly restricts unverified sandbox domains (`onboarding@resend.dev`) to only deliver emails to:
     1. The registered account owner's email address (`sumitkumar042006@gmail.com`).
     2. Official Resend sink webhooks (`delivered@resend.dev`, `bounced@resend.dev`, `complained@resend.dev`).
   - Any attempt to send password reset links to non-owner or arbitrary domains without a custom verified domain triggers a 403 `validation_error`.

2. **Absence of Domain DNS Verification in Production:**
   - In production, sending to general users requires a verified custom domain (e.g., `evoqgaming.com`) with SPF, DKIM, and MX DNS records configured in the Resend dashboard.

3. **Error Classification & Structured Logging Gaps:**
   - Resend errors were logged as general errors rather than structured security events with classified error types (`invalid_api_key`, `sender_domain_not_verified`, `malformed_recipient`, `provider_timeout`, `network_error`).

---

## 4. Evidence for Root Cause

Direct diagnostic dispatch testing against Resend SDK v6.26.0 produced the following verified outcomes:

| Recipient Address | Sender Identity | Resend API Response | Status | Email ID Returned |
|---|---|---|---|---|
| `sumitkumar042006@gmail.com` (Account Owner) | `EVOQ Gaming <onboarding@resend.dev>` | HTTP 200 OK | **SUCCESS** | `30d712a1-0a47-493f-b592-c5180edb1662` |
| `delivered@resend.dev` (Official Sink) | `EVOQ Gaming <onboarding@resend.dev>` | HTTP 200 OK | **SUCCESS** | `50f9ddcf-51f7-44c2-a9d7-0c00ef62523a` |
| `bounced@resend.dev` (Simulated Bounce) | `EVOQ Gaming <onboarding@resend.dev>` | HTTP 200 OK | **SUCCESS** | `2ef4d6f7-e5e9-4b80-ba78-35e52ad6bd37` |
| `complained@resend.dev` (Simulated Complaint) | `EVOQ Gaming <onboarding@resend.dev>` | HTTP 200 OK | **SUCCESS** | `e266fa20-93ad-4d23-986a-f62b79dff9ee` |
| `testuser@gmail.com` (Arbitrary Non-Owner) | `EVOQ Gaming <onboarding@resend.dev>` | HTTP 403 `validation_error` | **REJECTED BY RESEND** | `null` |

---

## 5. Resend SDK & Integration Architecture

- **Package:** `resend@^6.26.0` (Installed in `server/package.json`).
- **Initialization:** Singleton client initialized via `getResendClient()` using server-only `config.resendApiKey`.
- **SDK Method:** `await client.emails.send({ from, to, subject, html })`.
- **Async Handling:** Strictly awaited; promises unwrapped and checked for both `result.error` and exceptions.

---

## 6. Environment Variable Validation

Diagnostic audit of server environment configuration:

| Variable | Server Present | Client Bundle Exposure | Prefix Check | Hardcoded Fallback Check |
|---|---|---|---|---|
| `RESEND_API_KEY` | `true` (server process only) | `false` (Not bundled in Vite) | No `VITE_` prefix | **NONE** (Only loaded from `.env`) |
| `EMAIL_FROM` | `true` (`EVOQ Gaming <onboarding@resend.dev>`) | `false` | No `VITE_` prefix | **NONE** |
| `APP_URL` | `true` (`http://localhost:5173`) | `false` | No `VITE_` prefix | Standard normalized origin |

---

## 7. EMAIL_FROM & Sender Identity Validation

- **Current Config:** `EMAIL_FROM=EVOQ Gaming <onboarding@resend.dev>`
- **Development/Test Validity:** Valid **only** for account owner (`sumitkumar042006@gmail.com`) and Resend test sinks (`delivered@resend.dev`).
- **Production Target:** Must be changed to `EVOQ Gaming <no-reply@evoqgaming.com>` once the domain DNS verification is complete.

---

## 8. APP_URL & Reset Link Validation

- **Format:** `${APP_URL}/reset-password/${rawToken}`
- **Security Validation:**
  - `APP_URL` is stripped of trailing slashes before URL construction.
  - Raw token is a 64-character cryptographically secure hex string (`crypto.randomBytes(32).toString('hex')`).
  - Raw token is **never** printed in server logs or API responses.
  - Diagnostics log strictly: `resetUrlGenerated: true`.

---

## 9. Domain Verification Status (DNS Requirements)

Domain verification cannot be completed from the local codebase and constitutes an external DNS configuration dependency.

To achieve full production readiness for arbitrary recipient delivery:
1. **Resend Dashboard:** Add domain `evoqgaming.com` under `resend.com/domains`.
2. **DNS Records to Add:**
   - **DKIM:** TXT record `resend._domainkey.evoqgaming.com` with Resend-provided public key.
   - **SPF:** TXT record `evoqgaming.com` with `v=spf1 include:amazonses.com ~all` (or Resend include).
   - **Return-Path:** CNAME record `bounces.evoqgaming.com` pointing to `feedback-smtp.us-east-1.amazonses.com` / Resend endpoint.
   - **MX:** Optional MX records if inbound processing is enabled.
3. **Status:** Marked as **EXTERNAL DEPENDENCY REQUIRED**.

---

## 10. Code Changes Summary

### 1. `server/src/services/emailService.js`
- Added `classifyResendError(error)` to categorize failures safely into:
  - `invalid_api_key` (401)
  - `sender_domain_not_verified` (403)
  - `malformed_recipient` (422)
  - `provider_timeout` (timeout/ETIMEDOUT)
  - `network_error` (ECONNRESET/ECONNREFUSED)
  - `missing_configuration`
  - `provider_rejected`
  - `unexpected_provider_error`
- Implemented structured security logging:
  - Success: `{ event: "password_reset_email", provider: "resend", status: "accepted", emailId: "..." }`
  - Failure: `{ event: "password_reset_email", provider: "resend", status: "failed", errorType: "..." }`
- Added `setResendClientForTesting(client)` hook for deterministic isolated testing.

### 2. `server/src/services/passwordResetService.js`
- Added safe diagnostic logging (`resetUrlGenerated: true`) without logging tokens or URLs.
- Structured dispatch error logging without throwing exceptions on email delivery failure, ensuring anti-enumeration protection remains intact.

### 3. `server/.env.production.example`
- Added complete production documentation for `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, and verified custom domain requirements.

### 4. `.gitignore`
- Broadened ignore patterns (`.env`, `.env.*`, `.env.production`, `.env.*.local`) to prevent secret exposure.

---

## 11. Security Review & Anti-Enumeration Defense

| Security Dimension | Implementation Detail | Status |
|---|---|---|
| **Account Enumeration Defense** | Existing & non-existing emails return the exact same generic message: `"If an account matches that email address, a password reset link has been sent."` | **VERIFIED** |
| **Token Storage** | Only SHA-256 hash (`password_reset_tokens.token_hash`) is stored in MySQL. Raw token exists only transiently in memory. | **VERIFIED** |
| **One-Time Token Use** | Token is invalidated immediately upon successful reset (`used_at = NOW()`). Subsequent attempts return 400 Bad Request. | **VERIFIED** |
| **Token Expiry** | Tokens expire strictly after 30 minutes (`expires_at > NOW()`). | **VERIFIED** |
| **New Request Invalidation** | A new reset request invalidates all previous active tokens for that user. | **VERIFIED** |
| **Session Revocation** | Password reset updates `users.token_version = token_version + 1` and invalidates token version cache, instantly revoking all existing JWT sessions. | **VERIFIED** |
| **Rate Limiting** | `authRateLimiter` enforces strict request thresholds on `POST /api/auth/forgot-password` and `POST /api/auth/reset-password`. | **VERIFIED** |

---

## 12. Automated Test Suite Results

### Server Test Suite (`vitest run --no-file-parallelism`)
- **Total Test Files:** 44 passed (44 total)
- **Total Tests:** 237 passed (237 total)
- **Email & Auth Suites:**
  - `src/services/emailService.test.js` (7 tests passed)
  - `src/test/security/resendEmailDelivery.security.test.js` (3 tests passed)
  - `src/services/passwordResetService.test.js` (6 tests passed)
  - `src/test/integration/auth.integration.test.js` (5 tests passed)
  - `src/test/security/authAndTokenAttacks.security.test.js` (6 tests passed)

### Client Test Suite (`vitest run`)
- **Total Test Files:** 11 passed (11 total)
- **Total Tests:** 49 passed (49 total)
- **Auth UI Suites:**
  - `src/services/authApi.test.js` (3 tests passed)
  - `src/app/App.test.jsx` (11 tests passed)
  - `src/test/e2e/playerJourney.e2e.test.jsx` (6 tests passed)

### Production Build Verification
- **Client Build (`npm run build`):** PASSED (Vite bundled in 514ms)
- **Server Build (`npm run build`):** PASSED (`node --check src/index.js` validated)

---

## 13. Production Configuration Requirements & Deployment Checklist

Before production release, the following steps must be performed by DevOps / Platform Admin:
1. Obtain production Resend API Key (`re_...`).
2. Verify the custom domain `evoqgaming.com` in Resend by creating required DNS records (DKIM, SPF, CNAME).
3. Set environment variables on the production server / secret manager:
   ```bash
   RESEND_API_KEY=re_live_production_key_here
   EMAIL_FROM=EVOQ Gaming <no-reply@evoqgaming.com>
   APP_URL=https://evoqgaming.com
   ```
4. Confirm test dispatch from production dashboard to external corporate address.

---

## 14. Final Verdict

```
============================================================
FINAL STATUS:
CONDITIONAL PASS — EXTERNAL RESEND CONFIGURATION REQUIRED
============================================================
```

**Justification:**  
All backend services, email dispatch logic, SDK integrations, SHA-256 token hashing, session revocation, anti-enumeration defenses, error classification, rate limiting, and automated test suites have been verified with 100% pass rates. Real dispatch was validated against Resend with generated email IDs for the account owner and official test sinks. Dispatch to arbitrary third-party recipient addresses requires external DNS verification of a custom domain in the Resend dashboard.
