# EVOQ — REALTIME SOCKET.IO & ORGANIZATION PROFILE BUGFIX REPORT

**Document ID:** `EVOQ-REALTIME-ORG-FIX-2026-09-12`  
**Platform:** EVOQ Esports Tournament SaaS  
**Evaluation Status:** **PASS**  

---

## 1. Executive Summary

This targeted fix resolves two production-blocking frontend issues in EVOQ:
1. **Bug 1 — Socket.IO WebSocket Connection Failure:** The browser reported `WebSocket is closed before the connection is established` due to React lifecycle re-render race conditions in `SocketContext.jsx`, coupled with unproxied `/socket.io` paths in the Vite development proxy.
2. **Bug 2 — Organization Profile PUT 400 Bad Request:** Form submissions from `OrganizerOrganizationSettingsPage.jsx` failed validation when optional fields contained empty strings (`""`), un-normalized slugs with spaces/uppercase, or un-parsed numeric values, and lacked structured field-level validation feedback.

Both issues have been remediated, verified with unit and integration tests, and validated in MySQL and client builds.

---

## 2. Bug 1 — Socket.IO WebSocket Connection Failure

### 2.1 Root Cause Analysis
- **React Lifecycle & Unstable `identity` Dependency:** `SocketContext.jsx` listened to `[identity]` in `useEffect`. On initial page load, `identity` was read from localStorage and the socket initiated a connection. Milliseconds later, `verifySession()` completed `GET /auth/me` and called `setIdentity()`, producing a new object reference. This triggered the `useEffect` cleanup (`socket.disconnect()`) while the initial WebSocket upgrade handshake was still in-flight, forcibly aborting the connection with `WebSocket is closed before the connection is established`.
- **Proxy Architecture & CORS Mismatches:** `vite.config.js` only proxied `/api` to `http://127.0.0.1:4000`, omitting `/socket.io` with `ws: true`. As a result, the frontend attempted direct connection across ports (`5173` -> `4000`) where origin handling and socket creation races exacerbated disconnects.

### 2.2 Files Changed
1. `client/src/context/SocketContext.jsx`
2. `client/vite.config.js`
3. `server/src/index.js`

### 2.3 Implementation Details & Fixes
- **Stable Lifecycle Tracking:** Modified `SocketContext.jsx` to key off `userId` (`identity?.id`) and `token`. If a valid socket connection already exists for the current user and token, reference changes to `identity` do NOT disconnect or recreate the socket.
- **Vite Proxy Support:** Added `/socket.io` proxy with `ws: true` and `changeOrigin: true` in `client/vite.config.js`.
- **Server CORS & Transports:** Configured Socket.IO server in `server/src/index.js` with `path: '/socket.io'`, `transports: ['polling', 'websocket']`, and allowed origins (`config.clientOrigin`, `http://localhost:5173`, `http://127.0.0.1:5173`).
- **Clean Event Listener Cleanup:** Replaced anonymous listener attachments with named handler functions (`handleConnect`, `handleDisconnect`, `handleConnectError`) and resubscription of active tournament/group rooms on reconnect.

---

## 3. Bug 2 — Organization Profile PUT 400 Bad Request

### 3.1 Root Cause Analysis
- **Empty String vs. Null Schema Mismatches:** Form fields such as `slug`, `websiteUrl`, `twitterUrl`, `instagramUrl`, `description`, `about`, `country`, and `city` default to `""` in React state.
- In `validateOrganizationUpdate`, empty strings or un-normalized values caused validation failures or passed empty strings (`""`) to MySQL. Because `organizations.slug` has a `UNIQUE` constraint, saving empty strings caused SQL constraint collisions or validation 400s.
- `OrganizerOrganizationSettingsPage.jsx` lacked client-side normalization (e.g. trimming, auto-lowercasing slugs) and displayed only a generic `"Validation failed"` error instead of highlighting the specific invalid field.

### 3.2 Files Changed
1. `server/src/validators/organizationValidators.js`
2. `server/src/services/organizationService.js`
3. `server/src/repositories/organizationRepository.js`
4. `client/src/pages/organizer/OrganizerOrganizationSettingsPage.jsx`
5. `server/src/routes/organizationProfile.test.js`

### 3.3 Implementation Details & Fixes
- **Validator Hardening:** Updated `validateOrganizationUpdate` to treat empty or whitespace-only strings as valid empty values. Slugs are trimmed, lowercased, and checked against `^[a-z0-9-]+$` with length 3–80.
- **Service & Repository Normalization:** `updateMyOrganizationProfile` normalizes all optional string fields, converting `""` to `null` before database execution, preventing `ER_DUP_ENTRY` and preserving unique constraint integrity.
- **Client UX & Field Errors:** Added field-level error state in `OrganizerOrganizationSettingsPage.jsx`. Validation errors returned in `error.details.body` are rendered directly below each corresponding input field.

---

## 4. Verification & Test Evidence

### 4.1 Server Test Suite
- **Total Test Files Passed:** 45 / 45 files (100%)
- **Total Tests Passed:** 241 / 241 tests (100%)
- **Targeted Test Suites:**
  - `src/routes/organizationProfile.test.js` (4 tests passed)
  - `src/routes/organizationRoutes.test.js` (4 tests passed)
  - `src/services/organizationService.test.js` (5 tests passed)
  - `src/sockets/index.test.js` (4 tests passed)
  - `src/test/integration/realtimeSockets.integration.test.js` (2 tests passed)
  - `src/test/security/realtimeSocketAttacks.security.test.js` (3 tests passed)

### 4.2 Client Test Suite & Build
- **Total Test Files Passed:** 11 / 11 files (100%)
- **Total Tests Passed:** 49 / 49 tests (100%)
- **Client Production Build (`npm run build`):** PASSED in 270ms.

---

## 5. Security & RBAC Review

| Security Control | Validation Result |
|---|---|
| **Role-Based Access Control** | `PUT /api/organizations/me/profile` is strictly guarded by `requireRoles('ORGANIZER')`. Player accounts receive 403 Forbidden. |
| **IDOR Protection** | Organization profile updates resolve the organization strictly by the authenticated `req.user.id` (`getOrganizationByOwnerId`). No arbitrary IDs can be manipulated. |
| **Socket.IO Room Authorization** | Room joins (`join_tournament`, `join_group`) enforce `canJoinTournament` / `canJoinGroup` server-side verification. |
| **JWT Session Integrity** | Socket authentication verifies `tokenVersion` against the database to guarantee revoked tokens cannot connect. |

---

## 6. Final Status

```
============================================================
FINAL STATUS: PASS
============================================================
```
- WebSocket upgrades cleanly establish without premature close.
- Organization profile PUT saves validated data and persists to MySQL.
- All 241 server tests and 49 client tests pass.
