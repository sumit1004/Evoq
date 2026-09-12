# EVOQ — FINAL BREVO IP AUTHORIZATION & DELIVERY VERIFICATION REPORT

**Document ID:** `EVOQ-BREVO-FINAL-VERIFY-2026-09-13`  
**Date:** September 13, 2026  
**Status:** **CONDITIONAL PASS — BACKEND CODE COMPLETE; LIVE DISPATCH BLOCKED BY EXTERNAL BREVO AUTHORISED-IP RESTRICTION**  

---

## 1. Executive Summary & Brevo Security Status

Direct diagnostic API probes against the live Brevo API v3 (`https://api.brevo.com/v3/smtp/email` and `https://api.brevo.com/v3/account`) using the configured `BREVO_API_KEY` yielded the following response:

```json
{
  "message": "We have detected you are using an unrecognised IP address 2409:40c4:3108:2148:fdfc:f6f8:eef9:db29. If you performed this action make sure to add the new IP address in this link: https://app.brevo.com/security/authorised_ips",
  "code": "unauthorized"
}
```

### Key Findings:
1. **Brevo Edge Gateway Block:** The Brevo account is configured with **"Authorised IPs"** (IP Whitelisting). All incoming API requests from non-whitelisted IP addresses (including the dynamic residential IPv6 `2409:40c4:3108:2148:fdfc:f6f8:eef9:db29`) are rejected with HTTP 401 before message ingestion.
2. **Dynamic vs. Static Egress IP:**
   - **In Local Development:** Residential and mobile ISP connections dynamically rotate IPv4 and IPv6 addresses. Whitelisting a single temporary IPv6 address is brittle because ISP IP reassignments will cause intermittent 401 rejections.
   - **Recommended Local Dev Fix:** In the Brevo Security settings ([https://app.brevo.com/security/authorised_ips](https://app.brevo.com/security/authorised_ips)), disable the IP whitelist restriction or generate an API key with unrestricted IP access.
   - **In Production/Staging:** In production on AWS/GCP/DigitalOcean, configure Brevo's Authorised IPs with the server's dedicated static elastic IP (EIP/NAT Gateway egress IP).
3. **Application Layer Health:**
   - The EVOQ backend correctly initiates password reset, computes SHA-256 token hashes, constructs valid MIME/HTML templates with XSS protection, sets 10s AbortController timeouts, and isolates all secrets from logs and client bundles.

---

## 2. Live Brevo Endpoint Diagnostic Trace

| Endpoint Tested | HTTP Status | Response Code | Provider Diagnostic Detail |
|---|---|---|---|
| `GET /v3/account` | `401 Unauthorized` | `unauthorized` | Rejection by Brevo IP Security Gate |
| `GET /v3/senders` | `401 Unauthorized` | `unauthorized` | Rejection by Brevo IP Security Gate |
| `GET /v3/senders/domains` | `401 Unauthorized` | `unauthorized` | Rejection by Brevo IP Security Gate |
| `GET /v3/smtp/blockedContacts` | `401 Unauthorized` | `unauthorized` | Rejection by Brevo IP Security Gate |
| `POST /v3/smtp/email` | `401 Unauthorized` | `unauthorized` | Rejection by Brevo IP Security Gate |

---

## 3. Operator Instructions to Unblock Live Delivery

To enable live transactional email dispatch to Gmail:

### Step 1: Adjust Brevo Authorised IPs
1. Navigate to: **[https://app.brevo.com/security/authorised_ips](https://app.brevo.com/security/authorised_ips)**
2. Choose one of the following:
   - **For Development:** Turn off the **"Authorised IP addresses"** toggle (or remove IP restrictions for API keys).
   - **For Static Server/Production:** Add your static egress IPv4/IPv6 address.
   - **Immediate Test:** Add your current IP (`2409:40c4:3108:2148:fdfc:f6f8:eef9:db29`).

### Step 2: Confirm Verified Sender Identity in Brevo
1. Go to **Brevo Dashboard > Senders & IP > Senders** ([https://app.brevo.com/senders](https://app.brevo.com/senders)).
2. Ensure the email configured in `server/.env` (`EMAIL_FROM`) is listed as a **Verified Sender**.
3. For production custom domain (`evoqgaming.com`), verify SPF (`include:spf.brevo.com`), DKIM (`mail._domainkey`), and DMARC DNS records.

### Step 3: Run End-to-End Forgot Password Dispatch
1. Open EVOQ at `http://localhost:5173/forgot-password`.
2. Enter your real Gmail address (e.g., `sumitkumar042006@gmail.com`).
3. Submit the request.
4. Check your Gmail Inbox, Spam, and Promotions folders for the **"Reset Your Password - EVOQ Gaming"** email.
5. Click the reset link in the email and set a new password.
6. Verify login with the new password and confirm token reuse is rejected.

---

## 4. Security & Architecture Audit

| Security Criterion | Validation State | Proof / Implementation |
|---|---|---|
| **Resend References** | **ZERO (0)** | Repository grep confirms 0 active implementation references |
| **Brevo Key Server-Only** | **CONFIRMED** | `BREVO_API_KEY` is never prefixed with `VITE_` and does not appear in client `dist/` |
| **Token In-Memory Only** | **CONFIRMED** | Raw 32-byte token exists only in-memory to build `resetUrl`; never stored in DB |
| **Token Hash Storage** | **CONFIRMED** | MySQL `password_reset_tokens` table stores only SHA-256 hashes |
| **Zero Sensitive Logs** | **CONFIRMED** | Server logs record only structured metadata (`provider=brevo`, `status=...`, `statusCode=...`) |
| **Anti-Enumeration** | **CONFIRMED** | Uniform message returned for existing and non-existing email queries |
| **Session Invalidation** | **CONFIRMED** | Password update increments `token_version`, revoking all existing JWT sessions |
| **Rate Limiting** | **CONFIRMED** | Express rate limiters active on `/api/auth/forgot-password` and `/api/auth/reset-password` |

---

## 5. Comprehensive Automated Test Suite Results

### Backend Server Test Results (`npm test --workspace server`)
- **Test Suites Passed:** 45 of 45 (100%)
- **Total Tests Passed:** 249 of 249 (100%)
- **Failures / Errors:** 0
- **Test Categories Covered:**
  - `brevoEmailDelivery.security.test.js` (anti-enumeration, token hash storage, multi-token invalidation, failure isolation)
  - `emailService.test.js` (Brevo payload construction, error classification, timeout handling, safe dev simulation)
  - `auth.integration.test.js` (full MySQL password reset lifecycle & session revocation)
  - `roleEscalationAndIdor.security.test.js`, `tournamentSecurity.test.js`, `paymentRoutes.test.js`, `directMessageRoutes.test.js`, etc.

### Frontend Client Test Results (`npm test --workspace client`)
- **Test Suites Passed:** 11 of 11 (100%)
- **Total Tests Passed:** 49 of 49 (100%)
- **Failures / Errors:** 0

### Client Production Build (`npm run build --workspace client`)
- **Vite Build Result:** Successfully built in 313ms (0 errors, 206 modules transformed).

---

## 6. Final Status & Conclusion

**Final Status:** **CONDITIONAL PASS**  
- **Reason:** All application code, Brevo REST API v3 integration, security defenses, token lifecycle, and 298/298 automated tests are verified. Real delivery to a physical Gmail inbox requires external IP whitelisting / authorization toggle in the Brevo Dashboard account settings.
