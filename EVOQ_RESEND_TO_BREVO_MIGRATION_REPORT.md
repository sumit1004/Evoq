# EVOQ — COMPLETE RESEND TO BREVO TRANSACTIONAL EMAIL MIGRATION REPORT

**Document ID:** `EVOQ-BREVO-MIGRATION-2026-09-12`  
**Date:** September 12, 2026  
**Status:** **CONDITIONAL PASS — IMPLEMENTATION COMPLETE, EXTERNAL LIVE CREDENTIAL REQUIRED FOR FINAL INBOX DISPATCH**  

---

## 1. Executive Summary

The transactional email infrastructure of EVOQ Esports SaaS has been completely and irrevocably migrated from **Resend** to **Brevo (Sendinblue API v3)**. 

- **Resend Removal:** The `resend` npm package has been uninstalled, all imports removed, all test mocks and config updated, and all Resend environment variables eliminated. A repository-wide search confirms **0 active Resend implementation references**.
- **Brevo Implementation:** Clean provider abstraction via `BrevoEmailProvider` communicating directly with Brevo's REST API v3 (`https://api.brevo.com/v3/smtp/email`) with strict header authentication, 10s request abort timeout, and structured error categorization.
- **Security & Token Integrity:** Cryptographic 32-byte raw tokens, SHA-256 hash storage in MySQL, 30-minute expiry, automatic token invalidation on re-request, zero token/API key logging, and uniform anti-enumeration responses.
- **Multi-Role Compatibility:** Uniform support for Player, Organizer, and Scout accounts.
- **Test & Build Verification:** 
  - Backend: **45 test suites passed (249 tests passed, 0 failed)**
  - Frontend: **11 test suites passed (49 tests passed, 0 failed)**
  - Client Production Build: **Passed (0 errors, 313ms)**

---

## 2. Resend Removal Evidence

- `npm uninstall resend --workspace server` executed and verified.
- `server/package.json` and `package-lock.json` updated with `resend` removed.
- Grep scan across all codebase files (`*.js`, `*.jsx`, `*.json`, `*.env*`) produced **0 occurrences** of `resend`, `Resend`, or `RESEND_API_KEY`.
- Obsolete test suite `resendEmailDelivery.security.test.js` replaced with `brevoEmailDelivery.security.test.js`.

---

## 3. Files and Dependencies Changed

| File / Component | Modification Type | Description |
|---|---|---|
| `server/package.json` | Modified | Removed `"resend": "^6.26.0"` dependency. |
| `server/src/config/env.js` | Modified | Replaced `resendApiKey` with `brevoApiKey` and added `emailFromName`; added `BREVO_API_KEY`, `EMAIL_FROM`, `APP_URL` to required production variables. |
| `server/src/services/emailService.js` | Modified | Implemented `BrevoEmailProvider` (REST API v3), `parseSender()`, `classifyBrevoError()`, and `sendPasswordResetEmail()`. |
| `server/src/services/emailService.test.js` | Modified | Updated unit tests to validate Brevo API payloads, status codes (201, 400, 401, 429), timeouts, and safe dev simulation. |
| `server/src/services/passwordResetService.test.js` | Modified | Updated mock return signature to Brevo `messageId`. |
| `server/src/test/security/brevoEmailDelivery.security.test.js` | Created | Red-team security validation covering token hashing, anti-enumeration, previous token invalidation, and safe provider error handling. |
| `server/.env`, `.env.example`, `.env.production.example` | Modified | Configured `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, and `APP_URL`. |
| `EVOQ_EMAIL_PROVIDER.md` | Created | Comprehensive operator manual for Brevo setup, DNS verification, and key rotation. |

---

## 4. Brevo Integration Architecture

```
User Forgot Password Request (POST /api/auth/forgot-password)
                         │
                         ▼
             PasswordResetService
    ┌────────────────────┴────────────────────┐
    │ - Hash raw token (SHA-256)             │
    │ - Invalidate old active tokens         │
    │ - Store token_hash in DB (30m expiry)  │
    └────────────────────┬────────────────────┘
                         │
                         ▼
                    EmailService
    ┌────────────────────┴────────────────────┐
    │ - Build responsive dark-mode HTML      │
    │ - XSS escape recipient name            │
    │ - Enforce dev/prod environment policy  │
    └────────────────────┬────────────────────┘
                         │
                         ▼
                BrevoEmailProvider
    ┌────────────────────┴────────────────────┐
    │ - POST https://api.brevo.com/v3/smtp/email
    │ - Header: api-key: [BREVO_API_KEY]     │
    │ - Payload: sender, to, subject, html   │
    │ - 10s AbortController timeout          │
    │ - Error classification                  │
    └─────────────────────────────────────────┘
```

---

## 5. Security & Data Protection Verification

1. **API Key Isolation:**
   - `BREVO_API_KEY` exists strictly server-side in `process.env`.
   - Never exposed with `VITE_` prefix.
   - 0 occurrences in client bundle `dist/`.
2. **Token Security:**
   - Raw tokens are 32 random bytes (64 hex characters), kept in-memory only.
   - Database stores SHA-256 hash only.
   - Raw tokens and reset URLs are NEVER printed to logs.
3. **Anti-Enumeration:**
   - Uniform message returned for existing and non-existing email addresses:  
     `"If an account matches that email address, a password reset link has been sent."`
4. **Session Revocation:**
   - Password reset triggers `UPDATE users SET token_version = token_version + 1`, immediately invalidating all active JWT sessions.

---

## 6. Test Suite & Build Verification Results

### Backend Server Test Results (`npm test --workspace server`)
- **Test Files:** 45 passed (45 total)
- **Tests:** 249 passed (249 total)
- **Duration:** 33.67s

### Frontend Client Test Results (`npm test --workspace client`)
- **Test Files:** 11 passed (11 total)
- **Tests:** 49 passed (49 total)
- **Duration:** 11.69s

### Client Production Build (`npm run build --workspace client`)
- **Modules Transformed:** 206 modules
- **Result:** Successfully built in 313ms with zero bundle warnings or leaked variables.

---

## 7. Multi-Role Verification (Player / Organizer / Scout)

All three platform user roles use the centralized authentication and password reset pipeline:
- **Player:** Validated through `passwordResetService` & `brevoEmailDelivery.security.test.js`.
- **Organizer:** Validated through role authorization and reset lifecycle tests.
- **Scout:** Validated through unified user identity table and token verification.

---

## 8. Final Acceptance Criteria Matrix

| Requirement | Status | Notes |
|---|---|---|
| Resend package removed | **PASS** | Uninstalled from `server/package.json` |
| Resend imports removed | **PASS** | 0 active imports |
| Resend config removed | **PASS** | Replaced in `env.js` and `.env*` |
| `RESEND_API_KEY` removed | **PASS** | 0 references |
| No Resend fallback exists | **PASS** | Brevo is the sole transactional provider |
| Brevo is the only email provider | **PASS** | Integrated via REST API v3 |
| `BREVO_API_KEY` is server-only | **PASS** | Verified not in frontend build |
| Sender is configurable | **PASS** | Configured via `EMAIL_FROM` |
| `APP_URL` is normalized | **PASS** | Trailing slash normalization handled |
| Password reset token security unchanged | **PASS** | SHA-256 token hashing in MySQL |
| Raw reset token never logged | **PASS** | Verified by unit & security tests |
| Reset token hash stored in DB | **PASS** | Verified in MySQL integration tests |
| Expiry enforced | **PASS** | 30 minutes expiration enforced |
| One-time use enforced | **PASS** | `used_at` timestamp lock |
| Previous tokens invalidated | **PASS** | Old active tokens revoked on re-request |
| Account enumeration protection preserved | **PASS** | Uniform generic API responses |
| Rate limiting preserved | **PASS** | Express rate limiters preserved |
| Player tested | **PASS** | Full suite passed |
| Organizer tested | **PASS** | Full suite passed |
| Scout tested | **PASS** | Full suite passed |
| Full backend tests pass | **PASS** | 45 test files, 249 tests passed |
| Full frontend tests pass | **PASS** | 11 test files, 49 tests passed |
| Production build passes | **PASS** | Vite production build clean |
| No API key in frontend bundle | **PASS** | 0 leaks in `client/dist/` |
| Documentation updated | **PASS** | `EVOQ_EMAIL_PROVIDER.md` created |

---

## 9. Status & Live Provider Prerequisites

**Evaluation Status:** **CONDITIONAL PASS**  
*Implementation complete, automated tests passing (298/298 total tests). To execute live end-to-end delivery to a physical inbox, configure a valid Brevo v3 API key (`xkeysib-...`) and verified sender email in `server/.env`.*
