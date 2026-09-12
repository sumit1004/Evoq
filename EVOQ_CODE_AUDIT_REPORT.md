# EVOQ — Production Code Audit Report (Phase 1)

**Audit Date:** September 2026  
**Auditor:** Senior Staff Software Engineer, CTO-Level Reviewer & QA Architect  
**Scope:** Full EVOQ Monorepo (`server`, `client`, `database`, `Documents`)  
**Audit Mode:** Audit Only (No code modifications applied)

---

## 1. Executive Summary

A comprehensive architectural, security, lifecycle, database, realtime, and frontend audit was conducted on the EVOQ esports tournament management platform. The audit compared the **Documented Requirements & Canonical Architecture** against the **Actual Implementation** across all layers of the stack.

### Overall Assessment
The EVOQ codebase contains a well-structured domain model, parameterized SQL queries, secure password hashing (bcrypt cost 12), SHA-256 hashed password reset tokens, and binary signature magic-byte verification for image uploads. However, several **critical security vulnerabilities (P0)**, **business workflow & realtime synchronization bugs (P1)**, and **architectural maintainability issues (P2/P3)** exist that must be remediated prior to production deployment.

### Key Risk Areas
1. **Critical Security Vulnerabilities (P0):**
   - Hardcoded Resend API key fallback checked into source code (`server/src/config/env.js`).
   - Unauthenticated, unrestricted public access to confidential payment evidence screenshots (`/api/media/*`).
   - Unhandled null reference exception in Socket.IO join handlers causing socket server errors on invalid room requests.
   - Lifecycle completion lock bypass: Organizers can modify registrations and competition states after a tournament is marked `COMPLETED`.
2. **Realtime & State Breakages (P1):**
   - `SocketContext.jsx` fails to export `socket`, causing silent breakdown of realtime updates in Scout and Organizer workspaces.
   - `users.token_version` is incremented upon password reset, but `authMiddleware.js` never validates it, meaning existing/stolen JWTs remain valid until expiration.
   - Archive cleanup irreversibly deletes all tournament announcements, violating historical record retention requirements.
   - Unchecked self-verification of payment accounts in `connectPaymentAccount`.
3. **Architecture & Maintainability (P2/P3):**
   - Overly permissive route-level middleware (`requireRoles('PLAYER', 'ORGANIZER', 'ADMIN')` on sensitive organizer mutations).
   - Massive monolithic frontend components (`PlayerProfilePage.jsx` > 2,100 lines; organizer management pages > 1,000 lines each).
   - Direct database repository imports in controllers bypassing the service layer (`playerProfileController.js`, `paymentController.js`).
   - Brittle positional parameter slicing (`params.slice(1)`) in dynamic tournament listing SQL.
   - Complete reliance on mocked repositories in tests; zero integration tests validating actual database transactions and foreign key constraints.

---

## 2. Architecture Map & Inventory

```
+-------------------------------------------------------------------------------+
|                                  CLIENT (Vite + React)                        |
|  - Pages: Public, Player, Organizer, Scout                                    |
|  - Contexts: AuthContext (JWT in localStorage), SocketContext (Socket.IO client)|
|  - Services: Axios apiClient with request/response interceptors               |
|  - Monolithic Views: PlayerProfilePage (80KB), OrganizerGroupPage (46KB)      |
+-------------------------------------------------------------------------------+
                                      |
                           HTTP REST  |  WebSocket (Socket.IO)
                                      v
+-------------------------------------------------------------------------------+
|                                  SERVER (Node.js + Express)                   |
|  - Middleware: Security Headers, Auth (JWT), RBAC Roles, Multer, Rate Limiter |
|  - Sockets: JWT Auth Handshake, Room Authorization (user, tournament, group)  |
|  - Services: Auth, Tournament, Competition, Results, Scoring, Staff, Media   |
|  - Repositories: MySQL pool queries (mysql2)                                  |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|                                  DATABASE (MySQL 8.0+)                        |
|  - Migrations: 001_initial_schema through 014_password_reset_tokens           |
|  - Tables: users, tournaments, registrations, rounds, groups, matches,        |
|            match_results, leaderboard_entries, qualifications, archives, etc. |
+-------------------------------------------------------------------------------+
```

### Codebase Inventory Findings
- **Duplicated Logic:**
  - `serializeMatch`, `serializeGroup`, and `serializeRound` are defined independently across both `competitionService.js` and `resultsService.js`.
  - Group participant access queries (`isPlayerAssignedToGroup`) are duplicated across `resultsRepository.js`, `competitionRepository.js`, and `communicationRepository.js`.
- **Giant Components:**
  - `client/src/pages/player/PlayerProfilePage.jsx` (2,135 lines / 80.3 KB): Combines overview, game profiles, practice sessions, scrimmage logs, tournament history, match history, multiple modals, and inline forms in one component.
  - `client/src/pages/organizer/OrganizerGroupPage.jsx` (1,126 lines / 46.3 KB)
  - `client/src/pages/organizer/OrganizerTournamentPage.jsx` (1,080 lines / 44.8 KB)
  - `client/src/pages/organizer/OrganizerScoutsPage.jsx` (1,060 lines / 43.5 KB)
  - `client/src/pages/organizer/OrganizerRegistrationsPage.jsx` (980 lines / 43.0 KB)
  - `client/src/pages/organizer/OrganizerCompetitionPage.jsx` (890 lines / 37.0 KB)
- **Dead & Broken Code:**
  - `OrganizerScoutsPage.jsx` line 136: `const { socket } = useSocket();` is completely unused.
  - `ScoutWorkspacePage.jsx` line 12 and `ScoutTournamentPage.jsx` line 13: `const { socket } = useSocket();` receives `undefined` because `SocketContext` does not export `socket`.
- **Missing Service Layer:**
  - `paymentController.js` directly calls `paymentRepo.upsertPaymentAccount` and `paymentRepo.deletePaymentAccount`.
  - `playerProfileController.js` directly calls `playerProfileRepository` methods for practice sessions and matches.
- **Inconsistent API Response Formats:**
  - Some endpoints wrap responses in `{ [entity]: data }` (e.g. `{ tournament }`), some return `{ success: true, ... }`, and others return raw arrays or `{ total, ... }`.

---

## 3. Security Findings

### SEC-01: Hardcoded Fallback Resend API Key in Source Code (P0)
- **File:** `server/src/config/env.js:43`
- **Problem:** `resendApiKey: process.env.RESEND_API_KEY || 're_***'` (hardcoded API key fallback in source)
- **Impact:** An active or exposed Resend API key is embedded directly in source code. If deployed without setting `RESEND_API_KEY`, the hardcoded token is used, risking unauthorized quota consumption or email compromise.
- **Remediation:** Remove fallback token; require `RESEND_API_KEY` in environment or set to `null` if optional in local development.

### SEC-02: Public Unauthenticated Access to Private Payment Evidence (P0)
- **File:** `server/src/routes/mediaRoutes.js:7`, `server/src/controllers/mediaController.js:6-34`
- **Problem:** `mediaRouter.get('/*', serveMediaFile)` serves all files inside `uploads/` publicly without authentication. Payment screenshots uploaded by players to `uploads/payment-evidence/` are statically served if the path is requested.
- **Impact:** Violates confidentiality of payment evidence. Anyone with the URL can view sensitive player payment receipts, UPI references, and personal bank names.
- **Remediation:** Scope `mediaRoutes` strictly to public assets (avatars, banners, logos). Serve payment evidence exclusively through the authenticated, authorized endpoint `/api/registrations/:registrationId/payment-evidence`.

### SEC-03: In-Memory Rate Limiter Unbounded Memory Growth (P2)
- **File:** `server/src/middleware/securityMiddleware.js:10-21`
- **Problem:** `createRateLimiter` stores rate-limiting buckets in a plain Javascript `Map` keyed by `req.ip` without any TTL cleanup, eviction, or maximum size constraint.
- **Impact:** Under high volume or distributed requests, the `buckets` Map grows indefinitely, causing memory exhaustion and denial of service.
- **Remediation:** Implement periodic pruning of expired bucket timestamps or utilize Redis for rate limiting in multi-instance environments.

---

## 4. Authentication Findings

### AUTH-01: Stateless JWT Verification Bypasses Session Revocation on Password Reset (P1)
- **File:** `server/src/middleware/authMiddleware.js:23-37`, `server/src/services/passwordResetService.js:129-132`
- **Problem:** When a user resets their password, `passwordResetService` increments `users.token_version` to invalidate existing sessions. However, `authMiddleware.js` only executes `jwt.verify(token, config.jwtSecret)` statelessly without verifying `payload.tokenVersion` against the database.
- **Impact:** Compromised tokens remain fully valid until expiration (1 hour), failing to protect the user after a security reset.
- **Remediation:** Either implement token version validation against the user record / fast cache in `authMiddleware` or implement a revoked-token blacklist.

### AUTH-02: Simulated Email Mode Logs Sensitive Reset URLs (P3)
- **File:** `server/src/services/emailService.js:106-111`
- **Problem:** When Resend is not configured, `emailService` logs the raw `resetUrl` containing the unhashed 64-char token to `logger.info`.
- **Impact:** In shared logging environments or centralized log ingestors, unhashed reset tokens can be intercepted.
- **Remediation:** Mask or omit the raw token parameter from production logs.

---

## 5. Authorization & RBAC Findings

### AUTHZ-01: Tournament Completion Lock Bypass for Direct Organizers (P0)
- **File:** `server/src/services/registrationService.js:424-431`, `server/src/services/competitionService.js:15-25`
- **Problem:**
  - In `registrationService.reviewTournamentRegistration`:
    ```javascript
    if (registration.organizerId !== userId) {
      await assertTournamentAuthorization(registration.tournamentId, userId, {
        permission: requiredPerm,
        isWrite: true,
        connection,
      });
    }
    ```
    If `registration.organizerId === userId`, `assertTournamentAuthorization` is bypassed completely, skipping the check for `tournament.status === 'COMPLETED'`.
  - In `competitionService.assertAccess`:
    ```javascript
    if (context.organizer_id === userId) {
      return { isOwner: true, isStaff: true, permissions: new Set(Object.values(PERMISSIONS)) };
    }
    ```
    If the caller is the owner, `assertAccess` returns immediately without asserting that the tournament is not `COMPLETED`.
- **Impact:** The organizer can modify registrations (verify/reject), edit groups, assign/remove teams, and alter matches even after a tournament has reached the immutable `COMPLETED` state.
- **Remediation:** In both functions, enforce `if (isWrite && (context.tournament_status === 'COMPLETED' || context.status === 'COMPLETED')) throw errorResponses.conflict('Completed tournaments are read-only')` BEFORE returning owner context.

### AUTHZ-02: Overly Permissive Role Guards at Route Level (P2)
- **File:** `server/src/routes/competitionRoutes.js:22-56`, `server/src/routes/tournamentRoutes.js:37, 49-53`, `server/src/routes/resultsRoutes.js:10-30`
- **Problem:** Routes like `PATCH /tournaments/:tournamentId`, `POST /registrations/bulk-verify`, `POST /rounds/:roundId/auto-assign`, `POST /matches/:matchId/results`, `POST /rounds/:roundId/qualifications/finalize` include `'PLAYER'` in `requireRoles('PLAYER', 'ORGANIZER', 'ADMIN')`.
- **Impact:** Weakens defense-in-depth by letting non-organizer/non-staff roles reach service layers for administrative actions.
- **Remediation:** Remove `'PLAYER'` from route-level guards on organizer/staff mutation routes.

### AUTHZ-03: Missing Role Guard in Staff Management Sub-Router (P2)
- **File:** `server/src/routes/staffRoutes.js:7-13`
- **Problem:** `staffRouter.use(authenticateRequest)` has no role requirement. While service layer checks organizer ownership, route-level role enforcement is absent.
- **Remediation:** Add `requireRoles('ORGANIZER', 'ADMIN')` to `staffRouter`.

---

## 6. Tournament Lifecycle Findings

### LIFE-01: Missing LIVE Tournament Status Check in Team Removal (P2)
- **File:** `server/src/services/competitionService.js:426-446`
- **Problem:** `removeAssignedTeam` checks `context.status === 'COMPLETED'` on the group, but does not call `liveTournament(context)` unlike `assignVerifiedTeam`.
- **Impact:** Teams can be removed during invalid tournament lifecycle phases.
- **Remediation:** Add `liveTournament(context)` check to `removeAssignedTeam`.

### LIFE-02: Round Deletion Uses Group Permission Identifier (P3)
- **File:** `server/src/services/competitionService.js:757`
- **Problem:** `deleteTournamentRound` checks `permission: PERMISSIONS.DELETE_GROUP` instead of a round deletion permission or requiring owner authorization.
- **Remediation:** Enforce owner-only or dedicated `DELETE_ROUND` permission.

---

## 7. Data Isolation Findings

### ISO-01: Insecure Deletion Check in Archive Repository (P2)
- **File:** `server/src/services/archiveService.js:182-184`, `server/src/repositories/archiveRepository.js:50`
- **Problem:** In `deleteHistory`, the ownership check is `if (user.role !== 'ADMIN' && archive.organizer_id && archive.organizer_id !== user.id)`. If `archive.organizer_id` is null (or the original tournament record was detached), the condition evaluates to false and permits non-owners to delete history.
- **Remediation:** Require `archive.organizer_id === user.id` explicitly; deny deletion if organizer cannot be verified.

---

## 8. Registration & Payment Findings

### PAY-01: Self-Activation of Payment Accounts without Provider Verification (P1)
- **File:** `server/src/controllers/paymentController.js:12-26`
- **Problem:** `connectPaymentAccount` accepts arbitrary `{ status, onboardingStatus }` in `req.body` and writes them directly to the database via `paymentRepo.upsertPaymentAccount`.
- **Impact:** Organizers can claim an `ACTIVE` online payment account status without going through actual payment gateway onboarding or webhooks.
- **Remediation:** Move payment account management to `paymentService.js`; restrict status transitions to gateway webhook/verification flows.

### PAY-02: Payment Account Deletion Relies on Request Body on HTTP DELETE (P3)
- **File:** `server/src/controllers/paymentController.js:28-35`
- **Problem:** `deletePaymentAccount` reads `req.body.provider`. HTTP DELETE requests with bodies are rejected or stripped by standard proxies/CDNs.
- **Remediation:** Accept `provider` as a query parameter or path parameter (`DELETE /organizer/payment-account/:provider`).

---

## 9. Scoring & Leaderboard Findings

### SCORE-01: Brittle Positional Parameter Slicing in Tournament Listing Query (P3)
- **File:** `server/src/repositories/tournamentRepository.js:58-91`
- **Problem:** `const countParams = params.slice(1);` strips the first parameter (`viewerId`) because `selectFields` contains a correlated subquery. If `selectFields` or `params` order changes, SQL parameter misalignment will cause runtime query errors or corrupted filter results.
- **Remediation:** Maintain separate parameter arrays for `countQuery` and `listQuery` instead of slicing.

---

## 10. Completion & Archive Findings

### ARCH-01: Permanent Deletion of Tournament Announcements During Archive Cleanup (P1)
- **File:** `server/src/repositories/archiveRepository.js:46`, `Documents/00-product/business-rules.md:21-27`
- **Problem:** `markCompletedAndCleanup` executes `DELETE FROM announcements WHERE tournament_id = ?`. Business Rule 17 states *"Announcements append to existing history"* and Rule 21 states *"History must survive deletion of transient live data."*
- **Impact:** Completing a tournament permanently wipes all organizer communications and announcements from the database.
- **Remediation:** Retain `announcements` or serialize them into `tournament_archives.summary_json` before execution of cleanup.

---

## 11. Socket.IO & Realtime Findings

### SOCK-01: Unhandled Null Reference Exception in Socket Authorization Handlers (P0)
- **File:** `server/src/services/communicationService.js:114-132`
- **Problem:**
  ```javascript
  export async function canJoinTournament(tournamentId, userId) {
    const context = await repository.getTournamentAccess(tournamentId, userId);
    if (context && (context.organizer_id === userId || Boolean(context.is_participant))) {
      return true;
    }
    const staff = await resolveTournamentStaffContext(tournamentId, userId);
    return staff.isStaff; // Crashes if tournament does not exist and staff is null!
  }
  ```
  If `tournamentId` does not exist, `resolveTournamentStaffContext` returns `null`. Accessing `staff.isStaff` throws an uncaught `TypeError: Cannot read properties of null (reading 'isStaff')`.
- **Impact:** Client emitting `join_tournament` with an invalid ID crashes the socket handler and generates unhandled rejections on the server.
- **Remediation:** Use optional chaining: `return Boolean(staff?.isStaff)`.

### SOCK-02: Socket Instance Missing from SocketContext Provider (P1)
- **File:** `client/src/context/SocketContext.jsx:17`, `client/src/pages/scout/ScoutWorkspacePage.jsx:12`, `client/src/pages/scout/ScoutTournamentPage.jsx:13`
- **Problem:** `SocketContext` returns `{ connected, joinTournament, leaveTournament, joinGroup, leaveGroup, on, sendMessage }` and does NOT include `socket`. Both Scout pages destructure `const { socket } = useSocket();` and attempt `socket.on(...)` / `socket.emit(...)`.
- **Impact:** `socket` is `undefined`. Scout pages silently fail to register realtime listeners for access revocation, tournament updates, and room joins.
- **Remediation:** Update `ScoutWorkspacePage` and `ScoutTournamentPage` to use `on()` and `joinTournament()` provided by `useSocket()`, or export `socketRef.current`.

---

## 12. Frontend State & Component Architecture Findings

### FE-01: Monolithic Giant Components (P2)
- **File:** `client/src/pages/player/PlayerProfilePage.jsx` (2,135 lines), `client/src/pages/organizer/OrganizerGroupPage.jsx` (1,126 lines)
- **Problem:** Giant files combining dozens of distinct sub-features, forms, and modals with hundreds of re-render triggers.
- **Impact:** Poor maintainability, excessive bundle size, difficulty writing isolated unit tests, and performance lag on mobile devices.
- **Remediation:** Split into modular feature components (`GameProfilesSection`, `PracticeTracker`, `PerformanceStats`, `TournamentHistoryTable`).

### FE-02: Memory Leaks via Missing Socket Listener Cleanup (P2)
- **File:** `client/src/pages/player/PlayerDashboardPage.jsx:45-56`, `client/src/pages/organizer/OrganizerAnnouncementsPage.jsx:15-23`
- **Problem:** Calling `joinTournament` repeatedly inside `load()` without corresponding cleanup upon component unmount.
- **Remediation:** Pair `joinTournament` with `leaveTournament` in `useEffect` cleanup.

---

## 13. Test Coverage Findings

### TEST-01: False Confidence from Exclusively Mocked Unit Tests (P2)
- **Files:** `server/src/services/*.test.js`
- **Problem:** Every test file mocks all repositories using `vi.mock(...)`.
- **Impact:**
  - Actual SQL queries, joins, groupings, and constraints are never verified.
  - Transactions, table row locking (`FOR UPDATE`), and foreign key cascades are never tested against a live database.
  - Potential SQL syntax errors or schema mismatches will pass unit tests and only fail in production.
- **Remediation:** Implement integration test suite using MySQL test-seed database (`database/test-seed`).

---

## 14. Comprehensive Findings Classification Table

| ID | Severity | File | Function / Line | Problem | Why It Matters | Recommended Fix | Regression Test Required |
|---|---|---|---|---|---|---|---|
| **SEC-01** | **P0** | `server/src/config/env.js` | L43 | Hardcoded fallback Resend API key in code | Secret leak / unauthorized usage risk | Remove fallback string; require env variable | No |
| **SEC-02** | **P0** | `server/src/controllers/mediaController.js` | `serveMediaFile` (L6-34) | Unauthenticated public access to `/api/media/*` | Payment evidence screenshots exposed publicly | Restrict payment evidence to authenticated route | Yes |
| **AUTHZ-01** | **P0** | `server/src/services/registrationService.js` & `competitionService.js` | `reviewTournamentRegistration` (L424), `assertAccess` (L15) | Direct tournament owner bypasses `COMPLETED` lock | Violates immutable completion invariant | Assert `isWrite` status before returning owner context | Yes |
| **SOCK-01** | **P0** | `server/src/services/communicationService.js` | `canJoinTournament` (L120), `canJoinGroup` (L128) | Unhandled null reference if tournament does not exist | Socket event error / uncaught server rejection | Use `Boolean(staff?.isStaff)` safe navigation | Yes |
| **AUTH-01** | **P1** | `server/src/middleware/authMiddleware.js` | `authenticateRequest` (L23-37) | `token_version` ignored during JWT verification | Stolen JWTs remain valid after password reset | Validate `token_version` against DB/cache | Yes |
| **SOCK-02** | **P1** | `client/src/pages/scout/ScoutTournamentPage.jsx` | L13, L92-114 | Destructuring `socket` from `useSocket()` which is `undefined` | Realtime listeners for scout console fail silently | Use `on` and `joinTournament` methods from context | Yes |
| **ARCH-01** | **P1** | `server/src/repositories/archiveRepository.js` | `markCompletedAndCleanup` (L46) | Deletes all announcements during archive cleanup | Irreversibly destroys tournament communications | Retain announcements or snapshot into archive | Yes |
| **PAY-01** | **P1** | `server/src/controllers/paymentController.js` | `connectPaymentAccount` (L12-26) | Client sets `status: 'ACTIVE'` directly in request | Unverified payment accounts can be self-activated | Enforce gateway validation before activating | Yes |
| **AUTHZ-02** | **P2** | `server/src/routes/competitionRoutes.js`, `tournamentRoutes.js` | Route declarations | `PLAYER` role allowed in route-level guards for mutations | Weakens defense-in-depth authorization | Restrict route guards to `ORGANIZER`, `ADMIN` | Yes |
| **AUTHZ-03** | **P2** | `server/src/routes/staffRoutes.js` | L7 | `staffRouter` lacks role guard middleware | Non-organizers can reach staff controller | Add `requireRoles('ORGANIZER', 'ADMIN')` | Yes |
| **ISO-01** | **P2** | `server/src/services/archiveService.js` | `deleteHistory` (L182-184) | Deletion permitted if `organizer_id` is null | Risk of unauthorized history deletion | Require positive identity match | Yes |
| **FE-01** | **P2** | `client/src/pages/player/PlayerProfilePage.jsx` | Entire file (2,135 lines) | Monolithic giant component | High maintenance cost, unnecessary re-renders | Refactor into modular subcomponents | No |
| **FE-02** | **P2** | `client/src/pages/player/PlayerDashboardPage.jsx` | `load` (L45-56) | Missing `leaveTournament` on socket subscriptions | Memory leak and stale socket room listeners | Add cleanup in `useEffect` | Yes |
| **TEST-01** | **P2** | `server/src/services/*.test.js` | All unit test suites | Repositories 100% mocked with `vi.mock` | Database queries, locks, constraints not tested | Build integration test suite against test DB | Yes |
| **SEC-03** | **P2** | `server/src/middleware/securityMiddleware.js` | `createRateLimiter` (L10-21) | In-memory Map has no TTL eviction policy | Unbounded memory growth under high traffic | Add sliding-window eviction or Redis store | Yes |
| **LIFE-01** | **P2** | `server/src/services/competitionService.js` | `removeAssignedTeam` (L426) | Missing `liveTournament` check | Team removed in invalid tournament states | Add `liveTournament(context)` | Yes |
| **SCORE-01** | **P3** | `server/src/repositories/tournamentRepository.js` | `listTournaments` (L59) | `params.slice(1)` positional parameter coupling | Fragile SQL query parameter alignment | Separate count and list parameter lists | Yes |
| **PAY-02** | **P3** | `server/src/controllers/paymentController.js` | `deletePaymentAccount` (L29) | Expects `req.body.provider` on HTTP DELETE | Proxies strip body on DELETE requests | Pass provider in URL path / query params | Yes |
| **LIFE-02** | **P3** | `server/src/services/competitionService.js` | `deleteTournamentRound` (L757) | Checks `DELETE_GROUP` instead of round perm | Inconsistent permission semantics | Add `DELETE_ROUND` permission check | Yes |
| **AUTH-02** | **P3** | `server/src/services/emailService.js` | `sendPasswordResetEmail` (L106-111) | Raw reset token logged in simulated dev mode | Potential secret leakage in shared logs | Mask token in logger outputs | No |

---

## 15. Recommended Remediation Order (Phase 2 Roadmap)

### Stage 1: Critical Security & Crash Fixes (P0)
1. Remove hardcoded Resend API key fallback from `server/src/config/env.js`.
2. Secure `/api/media/*` to prevent unauthorized public exposure of payment screenshots.
3. Fix null reference crash in `canJoinTournament` and `canJoinGroup` in `communicationService.js`.
4. Fix completion lock bypass in `registrationService.js` and `competitionService.js`.

### Stage 2: Business Workflow & Realtime Integrity (P1)
1. Add `token_version` validation to `authMiddleware.js` for true password reset session revocation.
2. Fix `SocketContext` usage in `ScoutTournamentPage.jsx` and `ScoutWorkspacePage.jsx`.
3. Fix `markCompletedAndCleanup` to preserve tournament announcements.
4. Move payment account management to `paymentService.js` and validate status updates.

### Stage 3: Authorization & Lifecycle Hardening (P2)
1. Clean up route guards across `competitionRoutes.js`, `tournamentRoutes.js`, `resultsRoutes.js`, and `staffRoutes.js`.
2. Implement TTL cache / Map pruning in `securityMiddleware.createRateLimiter`.
3. Add lifecycle check to `removeAssignedTeam`.
4. Fix `deleteHistory` ownership assertion in `archiveService.js`.

### Stage 4: Code Quality, Frontend Modularization & Testing (P2 / P3)
1. Refactor `PlayerProfilePage.jsx` into smaller, focused components.
2. Fix `deletePaymentAccount` to avoid reading body on HTTP DELETE.
3. Decouple `countParams` from `listParams` in `tournamentRepository.js`.
4. Add database integration tests covering full lifecycle and transactional locks.

---
*Report generated strictly under Phase 1 (Audit Only) guidelines.*
