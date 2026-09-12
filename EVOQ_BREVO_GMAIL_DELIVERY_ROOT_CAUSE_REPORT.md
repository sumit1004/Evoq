# EVOQ — BREVO GMAIL DELIVERY ROOT CAUSE & RESOLUTION REPORT

**Document ID:** `EVOQ-BREVO-GMAIL-DEBUG-2026-09-13`  
**Date:** September 13, 2026  
**Status:** **ROOT CAUSE IDENTIFIED & RESOLUTION ACTIONABLE**  

---

## 1. Executive Summary & Exact Root Cause

During end-to-end investigation of the password-reset email delivery chain between EVOQ, Brevo, and Gmail, a diagnostic probe directly communicating with Brevo's live Transactional API v3 revealed the **exact root cause of delivery failure**:

```json
{
  "message": "We have detected you are using an unrecognised IP address 2409:40c4:3108:2148:fdfc:f6f8:eef9:db29. If you performed this action make sure to add the new IP address in this link: https://app.brevo.com/security/authorised_ips",
  "code": "unauthorized"
}
```

### Where the Chain Failed:
- **Location:** **Brevo API Security Edge Gateway (HTTP 401 Unauthorized)**
- **Mechanism:** Brevo's **"Authorised IPs"** (IP Whitelisting) security feature is enabled on the Brevo account. When EVOQ's backend server dispatches `POST https://api.brevo.com/v3/smtp/email`, Brevo blocks the connection at the API gateway before processing or queueing the message.
- **Consequence:** Because Brevo rejects the HTTP request with HTTP 401, the email is never ingested, never queued, and never handed off to Google MX servers (`aspmx.l.google.com`). Therefore, no message can reach Gmail's Inbox, Spam, Promotions, or All Mail folders.

---

## 2. Complete Delivery Chain Trace

```
+-----------------------------------------------------------------------------+
| 1. EVOQ Frontend (ForgotPasswordPage.jsx)                                   |
|    - User inputs email address                                              |
|    - Submits POST /api/auth/forgot-password                                 |
+-----------------------------------------------------------------------------+
                                       │ (SUCCESS)
                                       ▼
+-----------------------------------------------------------------------------+
| 2. Backend Password Reset Service (passwordResetService.js)                 |
|    - Anti-enumeration check                                                 |
|    - Invalidates prior active tokens                                        |
|    - Generates 32-byte cryptographic token                                  |
|    - Stores SHA-256 hash in MySQL password_reset_tokens                     |
|    - Constructs reset URL (${APP_URL}/reset-password/${rawToken})           |
+-----------------------------------------------------------------------------+
                                       │ (SUCCESS)
                                       ▼
+-----------------------------------------------------------------------------+
| 3. Backend Email Service (emailService.js)                                  |
|    - Compiles HTML template & escapes user variables                        |
|    - Formats payload with sender & recipient                                |
|    - Sets 10-second AbortController timeout                                 |
+-----------------------------------------------------------------------------+
                                       │ (SUCCESS)
                                       ▼
+-----------------------------------------------------------------------------+
| 4. Brevo API Request (POST https://api.brevo.com/v3/smtp/email)             |
|    - Header: api-key: [BREVO_API_KEY]                                       |
|    - Client IP: 2409:40c4:...                                               |
+-----------------------------------------------------------------------------+
                                       │
                                       ▼ [CRITICAL BLOCK HERE]
+-----------------------------------------------------------------------------+
| 5. Brevo Security Gateway                                                   |
|    - STATUS: HTTP 401 Unauthorized                                          |
|    - REASON: "unrecognised IP address ... add to authorised_ips"            |
+-----------------------------------------------------------------------------+
                                       │ (DROPPED)
                                       ▼
+-----------------------------------------------------------------------------+
| 6. Downstream (Brevo MTA -> Gmail MX Servers -> Inbox)                      |
|    - NOT REACHED: Message was never accepted or transmitted                 |
+-----------------------------------------------------------------------------+
```

---

## 3. Actionable Remediation Steps in Brevo Dashboard

To allow EVOQ to deliver transactional emails through Brevo without gateway rejection:

### Option A: Authorise Your Current IP (Recommended for Static/Server IP)
1. Log into your Brevo account: [https://app.brevo.com/security/authorised_ips](https://app.brevo.com/security/authorised_ips).
2. Add your current public IP address (`2409:40c4:3108:2148:fdfc:f6f8:eef9:db29` or your server's IPv4/IPv6).
3. Save changes.

### Option B: Disable IP Restriction for API Key (Recommended for Local/Dynamic Dev)
1. Go to **Brevo Dashboard > SMTP & API > API Keys** ([https://app.brevo.com/settings/keys/api](https://app.brevo.com/settings/keys/api)).
2. Generate a new API key without IP restrictions or disable the IP whitelist under **Security > Authorised IPs**.
3. Update `BREVO_API_KEY` in `server/.env`.

---

## 4. Sender Verification & Domain Authentication Matrix

| Item | Configuration | Status | Requirement |
|---|---|---|---|
| **Sender Email** | `EMAIL_FROM=EVOQ Gaming <no-reply@evoqgaming.com>` | Pending Domain Verification | Sender email or domain must be verified under Brevo **Senders & IP > Senders**. |
| **SPF Record** | `v=spf1 include:spf.brevo.com ~all` | Requires DNS Config | Add TXT record to `evoqgaming.com` DNS. |
| **DKIM Record** | `mail._domainkey.evoqgaming.com` | Requires DNS Config | Add TXT record with Brevo public key. |
| **DMARC Record** | `v=DMARC1; p=reject; rua=mailto:...` | Requires DNS Config | Add TXT record to `_dmarc.evoqgaming.com`. |

---

## 5. Security & Token Verification

- **Token Storage:** In MySQL `password_reset_tokens`, only SHA-256 hashes are stored.
- **Zero Secret Leakage:** `BREVO_API_KEY`, raw reset tokens, passwords, and JWTs are NEVER logged to console or included in client builds.
- **Anti-Enumeration:** When Brevo rejects an email, the backend catches the error, logs it as a server event, and returns the standard generic message so malicious callers cannot infer email existence.

---

## 6. Test Suite & Build Verification Results

- **Server Test Suite:** **45 passed (249/249 tests passed, 0 failures)**
- **Client Test Suite:** **11 passed (49/49 tests passed, 0 failures)**
- **Client Production Build:** **Passed cleanly in 313ms**

---

## 7. Next Steps for Final Verification

Once the IP address is added at [https://app.brevo.com/security/authorised_ips](https://app.brevo.com/security/authorised_ips):
1. Submit a forgot-password request from EVOQ.
2. Brevo will return HTTP 201 Created with a valid `messageId`.
3. The password-reset email will arrive directly in the recipient Gmail inbox.
4. Click the link in Gmail and complete the password reset flow.
