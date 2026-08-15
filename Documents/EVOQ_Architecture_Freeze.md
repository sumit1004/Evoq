# EVOQ Architecture Freeze --- Master Document

This is the consolidated production blueprint generated from the
approved EVOQ product specification and supplied rebuild analysis.

------------------------------------------------------------------------

# 00-product/vision.md

# EVOQ Product Vision

## Product

EVOQ is a production-grade esports tournament management platform for
players, teams, and tournament organizers.

## Core proposition

EVOQ combines tournament control and player communications into one
real-time platform.

The organizer controls: - tournament configuration - registrations -
rounds - groups - matches - rooms - results - leaderboards -
qualification - announcements - tournament completion

Players use EVOQ to: - manage profiles - create and manage teams -
discover tournaments - register teams - access assigned groups - receive
tournament information - view rooms, results and leaderboards -
communicate through group chat - receive relevant notifications

## Competition model

EVOQ is designed primarily for team-based tournaments with: - multiple
teams - multiple rounds - multiple groups per round - multiple teams per
group - multiple matches per group - organizer-controlled qualification

There is no bracket tree and no configurable 1v1/3v3/5v5
competition-format engine in the current product definition.

## Product principles

1.  Database is authoritative.
2.  Business rules are enforced server-side.
3.  Realtime updates never replace persistence.
4.  Completed tournaments are immutable.
5.  AI agents must follow the architecture contract.
6.  Every feature must be testable and observable.
7.  Production UI uses real backend data or explicit empty states.
8.  Temporary tournament data is retained only as long as required.

## Primary users

-   Player
-   Tournament Organizer
-   System Admin (administrative role is assumed in the existing
    analysis and must remain explicitly defined if implemented).

## Source basis

This document consolidates the supplied EVOQ product specification and
uploaded rebuild analysis documents. The uploaded documents identify
realtime, lifecycle, registration, leaderboard/result, responsive UI,
cleanup and security issues that the rebuild must address.

------------------------------------------------------------------------

# 00-product/requirements.md

# EVOQ Product Requirements

## 1. Authentication

Players and organizers can: - create an account - login - logout -
access authenticated functionality according to role

Every player has a unique player identifier.

## 2. Player profile

Player profile may contain: - name - email - mobile number - unique
player ID - in-game name - game UID - other registered player
information

## 3. Team management

A player can create multiple teams.

Create team flow: 1. Enter team name. 2. Enter unique player IDs. 3.
Backend resolves each ID to a registered player. 4. Backend validates
membership. 5. Team is created. 6. Creator becomes owner/leader.

Team functionality: - create - view - view members - delete own team

Team identity is independent of a tournament. Tournament participation
is represented by registration.

## 4. Tournament creation

Organizer configures: - tournament name - tournament date - registration
start/end - allowed teams - players per team - description - entry
type - payment QR/instructions when paid - dynamic prize positions

Entry types: - FREE - PAID

## 5. Registration

Player selects an existing team.

Backend validates: - team exists - team size is correct - members are
valid - registration is open - team is not already registered

Paid flow captures: - payment screenshot - transaction ID

Registration states: - PENDING - VERIFIED - REJECTED

Organizer can inspect the complete team registration, including every
member and payment data.

## 6. Registration isolation

All registration queries are scoped to tournament_id.

Organizer UI is tournament-contextual: Tournament → Pending / Verified /
Rejected.

## 7. Export

Registration export must contain: - tournament information - team
information - every registered member's information - payment
information where applicable

## 8. Tournament hierarchy

Tournament → Round → Group → Match → Result/Leaderboard.

A round can contain multiple groups. A group can contain multiple teams.
A group can contain multiple matches.

## 9. Group creation

Organizer can: - create groups - choose group size - manually select
teams - auto-select top N where supported

Only eligible verified/qualified teams may be assigned.

## 10. Group access

Every member of an assigned team receives access to that group.

Players must not access another group's restricted data.

## 11. Match management

Every match has independent: - identity - status - result -
leaderboard - completion state

One match must never overwrite another.

## 12. Qualification

Qualification is organizer-controlled.

When a round is complete: 1. all required groups are complete 2.
organizer reviews standings 3. organizer selects qualifying teams 4.
qualification records are stored 5. next round may use only qualified
teams

## 13. Communications Hub

Each tournament has: - Overview - Announcements - Groups - Leaderboard -
Results - Chat

## 14. Announcements

Announcements: - persist during the live tournament - append rather than
replace older announcements - broadcast through Socket.IO - do not
require page refresh

## 15. Notifications

Notifications include relevant tournament events such as: - registration
verified - group assigned - announcement - result uploaded - leaderboard
updated - round started/completed - tournament completed

Chat messages do not create global notifications.

## 16. Group chat

Chat is scoped to the assigned group. Players and organizer can
communicate in realtime. Messages are persisted during the active
tournament. Chat history may be deleted after completion.

## 17. Leaderboards

Views: - match - group - round - overall

Leaderboard updates must be persisted and propagated in realtime.

## 18. Results

Results are organized: Round → Group → Match.

Uploaded result media is temporary unless explicitly preserved in
archive requirements.

## 19. Tournament lifecycle

Required lifecycle: DRAFT → REGISTRATION_OPEN → REGISTRATION_CLOSED →
LIVE → COMPLETED.

Round: NOT_STARTED → IN_PROGRESS → COMPLETED.

Group: NOT_STARTED → IN_PROGRESS → COMPLETED.

A match lifecycle should be defined explicitly by the implementation;
recommended contract: SCHEDULED → LIVE → COMPLETED.

Completed tournaments are read-only.

## 20. Completion

A tournament can be completed only after the final round is complete and
required final standings are finalized.

Completion must: - calculate/persist final standings - create
archive/history snapshot - delete permitted transient data safely - lock
all tournament writes - notify relevant users - expose archive mode to
players

## 21. History

History preserves lightweight information such as: - tournament name -
completion date - registration count - final leaderboard - winners -
qualified teams by round - important final statistics

## 22. Responsive UX

Desktop, tablet and mobile are supported. Use normal CSS, not Tailwind
or Bootstrap. Tables may scroll horizontally inside bounded containers.
Sidebars collapse on small screens. Forms and modals adapt to viewport.

## 23. Security

Mandatory: - password hashing - JWT - role checks - resource
ownership/access checks - validation - parameterized SQL - secure file
upload validation - rate limiting where appropriate - safe error
handling - backend enforcement of lifecycle rules

------------------------------------------------------------------------

# 00-product/user-roles.md

# EVOQ User Roles

## Player

Can: - manage own profile - create teams - view own teams - delete teams
they own - register eligible teams - view their tournament
participation - access assigned groups - view allowed tournament data -
use group chat for assigned groups - receive notifications - view
leaderboards/results

Cannot: - create tournament structure - approve registrations - manage
another organizer's tournament - access another group's restricted
information - modify completed tournaments

## Organizer

Can: - create tournaments - manage own tournaments - configure
registrations - verify/reject registrations - inspect all registered
members - create rounds/groups/matches - assign eligible teams - manage
room information - upload results - update leaderboards - select
qualifiers - publish announcements - participate in group chat -
complete rounds/tournaments

Organizer authority is always scoped to tournaments they own.

## Admin

The existing analysis assumes a system-admin role. If implemented, Admin
can oversee system-wide data and operational controls. Admin permissions
must be explicitly specified before exposing destructive/global actions.

## Authorization model

Every protected operation evaluates: 1. authenticated identity 2. role
3. resource ownership or participant access 4. tournament lifecycle 5.
group access where relevant 6. operation-specific business rules

------------------------------------------------------------------------

# 00-product/business-rules.md

# EVOQ Business Rules

1.  Teams are reusable entities and are not owned by a single
    tournament.
2.  Registration is the tournament participation record for a team.
3.  A team cannot register twice for the same tournament.
4.  Only valid team members may be included in a registration.
5.  Paid registrations require payment evidence before verification.
6.  Only VERIFIED registrations are eligible for group assignment.
7.  Only teams eligible for a round may be assigned to its groups.
8.  A player can access a group only through membership in an assigned
    team or authorized organizer access.
9.  Match results are scoped to a specific match.
10. Leaderboard entries are scoped to a specific match/group/round as
    defined by the schema.
11. A round cannot complete until its required groups are complete.
12. Qualification is controlled by the organizer and stored explicitly.
13. Only qualified teams can enter the next round.
14. A completed tournament cannot be modified.
15. Backend APIs must enforce the completed-tournament lock.
16. Socket actions must also enforce authorization and lifecycle rules.
17. Announcements append to existing history.
18. Chat messages do not create notifications.
19. Notifications are user-specific and generated only for configured
    tournament events.
20. Registration queries must always be tournament-scoped.
21. History must survive deletion of transient live data.
22. Archive cleanup must be transactional.
23. File uploads must be validated for type and size.
24. No production flow uses dummy users, teams, registrations, results
    or leaderboards.
25. AI-generated code must not silently change these rules.

------------------------------------------------------------------------

# 01-architecture/system-architecture.md

# EVOQ System Architecture

## High-level architecture

React/Vite Client → REST API / Socket.IO → Express Application →
Controllers → Services → Repositories → MySQL

Socket.IO is a realtime transport layered over the same service/domain
logic.

## Backend layers

### Routes

Define HTTP contracts and middleware composition.

### Controllers

Translate HTTP requests into service calls and HTTP responses.
Controllers do not contain large business workflows.

### Services

Contain business rules, lifecycle transitions and transaction
orchestration.

### Repositories

Contain MySQL queries and persistence operations. Use parameterized
queries.

### Middleware

-   authentication
-   role authorization
-   ownership authorization
-   tournament access
-   validation
-   rate limiting where required
-   error handling

### Sockets

Socket handlers: - authenticate socket - validate action - invoke
services - emit persisted results

Socket handlers should not duplicate business logic already in services.

## Frontend layers

Pages → feature components → hooks/context → API services →
SocketContext → backend

Contexts should exist only for genuinely shared state. Avoid global
state for page-local data.

Recommended contexts: - AuthContext - SocketContext -
NotificationContext - optional AnnouncementContext/ChatContext where
shared across a hub

## Source of truth

Database/service state is authoritative. Socket events communicate state
changes. Frontend optimistic updates should not bypass server validation
for critical tournament operations.

## Repository structure

client/src: - app - components - pages - layouts - contexts - hooks -
services - utils - styles - routes

server/src: - config - routes - controllers - services - repositories -
middleware - validators - sockets - utils

database: - migrations - seeds - schema

docs: - product - architecture - ui - development - testing

------------------------------------------------------------------------

# 01-architecture/database-schema.md

# EVOQ Database Architecture

## Design goals

-   MySQL
-   foreign-key integrity
-   explicit lifecycle data
-   tournament isolation
-   reusable teams
-   first-class matches
-   transactional completion/archive
-   indexes for common access paths

## Canonical tables

### users

Core identity. Suggested fields: id, name, email, password_hash, role,
created_at, updated_at

### player_profiles

Player-specific data. Suggested fields: user_id, unique_player_id,
mobile, in_game_name, game_uid, created_at, updated_at

unique_player_id must be unique.

### teams

Reusable team identity. Suggested fields: id, name, owner_id,
created_at, updated_at

### team_members

Many-to-many membership. Suggested fields: id, team_id, user_id, role,
joined_at

Unique(team_id, user_id).

### tournaments

Suggested: id, organizer_id, name, description, tournament_date,
registration_start_at, registration_end_at, max_teams, players_per_team,
entry_type, entry_fee, payment_qr_path, payment_instructions, status,
created_at, updated_at, completed_at

### tournament_prizes

Dynamic prize positions. Suggested: id, tournament_id, position, amount

Unique(tournament_id, position).

### registrations

Suggested: id, tournament_id, team_id, status, transaction_id,
payment_screenshot_path, submitted_at, verified_at, verified_by,
rejection_reason, created_at, updated_at

Unique(tournament_id, team_id).

### rounds

Suggested: id, tournament_id, round_number, name, status, started_at,
completed_at, created_at, updated_at

Unique(tournament_id, round_number).

### groups

Suggested: id, round_id, name, status, group_size, room_id,
room_password, started_at, completed_at, created_at, updated_at

Unique(round_id, name).

### group_teams

Assignment entity. Suggested: id, group_id, team_id, assigned_at

Unique(group_id, team_id).

The database must also enforce or service-enforce that a team cannot be
assigned to conflicting groups within the same round.

### matches

First-class match entity. Suggested: id, group_id, match_number, name,
status, scheduled_at, started_at, completed_at, created_at, updated_at

Unique(group_id, match_number).

### match_results

Result data scoped to match/team. Suggested: id, match_id, team_id,
points, kills, placement, result_text, uploaded_by, created_at,
updated_at

Unique(match_id, team_id).

### leaderboard_entries

Persisted leaderboard snapshot/entry. Suggested: id, match_id, team_id,
points, kills, rank, created_at, updated_at

Unique(match_id, team_id).

If group/round aggregate leaderboards are persisted, add explicit scope
fields and uniqueness constraints rather than overloading match_number.

### qualifications

Suggested: id, round_id, team_id, source_group_id, selected_by,
selected_at

Unique(round_id, team_id).

### announcements

id, tournament_id, created_by, message, created_at

### notifications

id, user_id, tournament_id, type, content, read_at, created_at

### chat_messages

id, group_id, sender_id, message, created_at

### tournament_archives

Lightweight completed snapshot. Suggested: id, tournament_id,
tournament_name, completed_at, registration_count,
final_leaderboard_json, qualified_teams_json, winners_json,
summary_json, created_at

Unique(tournament_id).

## Key foreign keys

Use foreign keys for all relationships. Use ON DELETE CASCADE only where
deletion is intentionally safe. Do not use broad cascade rules that
could accidentally erase reusable users or teams.

## Indexes

At minimum: - users.email - player_profiles.unique_player_id -
team_members.team_id - team_members.user_id -
registrations.tournament_id/status - registrations.team_id -
rounds.tournament_id/status - groups.round_id/status -
group_teams.group_id/team_id - matches.group_id/status -
match_results.match_id/team_id - leaderboard_entries.match_id/team_id -
qualifications.round_id/team_id -
announcements.tournament_id/created_at - notifications.user_id/read_at -
chat_messages.group_id/created_at

## Important architecture decision

The older supplied analysis sometimes models teams with tournament_id
and matches using match_number fields. The production schema defined
here intentionally uses reusable teams, registration as tournament
participation, and a first-class matches table because those structures
better match the master product specification and prevent result
overwrites.

------------------------------------------------------------------------

# 01-architecture/api-contract.md

# EVOQ REST API Contract

All endpoints are under /api.

## Authentication

POST /auth/signup POST /auth/login POST /auth/logout (if server-side
session invalidation is implemented) GET /players/me PATCH /players/me

## Teams

GET /teams POST /teams GET /teams/:id DELETE /teams/:id

## Tournaments

GET /tournaments POST /tournaments GET /tournaments/:id PATCH
/tournaments/:id

## Registrations

GET /tournaments/:tournamentId/registrations POST
/tournaments/:tournamentId/registrations PATCH /registrations/:id GET
/registrations/:id GET /tournaments/:tournamentId/registrations/export

## Rounds

GET /tournaments/:tournamentId/rounds POST
/tournaments/:tournamentId/rounds GET /rounds/:roundId POST
/rounds/:roundId/complete

## Groups

GET /rounds/:roundId/groups POST /rounds/:roundId/groups GET
/groups/:groupId PATCH /groups/:groupId POST /groups/:groupId/complete

## Group teams

POST /groups/:groupId/teams DELETE /groups/:groupId/teams/:teamId

## Matches

GET /groups/:groupId/matches POST /groups/:groupId/matches GET
/matches/:matchId PATCH /matches/:matchId POST
/matches/:matchId/complete

## Results

GET /matches/:matchId/results POST /matches/:matchId/results GET
/tournaments/:tournamentId/results

## Leaderboards

GET /matches/:matchId/leaderboard GET /groups/:groupId/leaderboard GET
/rounds/:roundId/leaderboard GET /tournaments/:tournamentId/leaderboards
POST /matches/:matchId/leaderboard/recalculate

## Qualifications

GET /rounds/:roundId/qualifications POST /rounds/:roundId/qualifications
DELETE /rounds/:roundId/qualifications/:teamId

## Announcements

GET /tournaments/:tournamentId/announcements POST
/tournaments/:tournamentId/announcements DELETE /announcements/:id if
deletion is permitted before completion

## Notifications

GET /notifications POST /notifications/:id/read POST
/notifications/read-all

## Chat

GET /groups/:groupId/chat POST /groups/:groupId/chat

## Completion/history

POST /tournaments/:tournamentId/complete GET /history GET /history/:id
DELETE /history/:id

## Contract rules

-   All authenticated endpoints require JWT unless explicitly public.
-   Organizer mutations require organizer role plus tournament
    ownership.
-   Player access requires participation/public eligibility as
    appropriate.
-   Completed tournaments reject all live mutations.
-   Validation errors return a consistent 4xx structure.
-   Authorization failures return 403.
-   Missing resources return 404.
-   Unexpected failures return a safe 500 response and structured server
    log.
-   Critical mutations use database transactions.
-   Responses must never leak password hashes or private payment data to
    unauthorized users.

------------------------------------------------------------------------

# 01-architecture/authorization-matrix.md

# EVOQ Authorization Matrix

## Roles

PLAYER, ORGANIZER, ADMIN

## Resource rules

### Player

-   own profile: read/write
-   own teams: read/write/delete
-   other team private data: denied
-   own verified registrations: read
-   registration creation: allowed for own eligible team
-   tournament public discovery: read
-   assigned tournament/group data: read
-   assigned group chat: read/write
-   organizer controls: denied

### Organizer

-   own tournaments: full operational access
-   another organizer's tournaments: denied
-   own tournament registrations: read/update
-   own tournament groups/matches/results: write
-   participant group chat: allowed
-   global user administration: denied unless Admin

### Admin

System-wide access only for explicitly defined administrative functions.

## Critical authorization checks

### Tournament mutation

1.  JWT valid
2.  role is ORGANIZER or ADMIN
3.  tournament exists
4.  organizer owns tournament unless ADMIN
5.  tournament status permits mutation

### Group access

1.  JWT valid
2.  group exists
3.  tournament is identified
4.  user is organizer owner OR user belongs to a team assigned to group
5.  tournament status permits requested action

### Registration inspection

Organizer must own tournament. Players can only inspect their own team's
registration.

### Team deletion

Only team owner can delete. Before deletion, verify dependencies and use
transaction/cascade strategy intentionally.

### Socket actions

Socket authentication is not authorization. Every privileged socket
action performs the same domain authorization as REST.

------------------------------------------------------------------------

# 01-architecture/realtime-architecture.md

# EVOQ Realtime Architecture

## Technology

Socket.IO with JWT authentication.

## Connection

Client sends JWT through Socket.IO auth: auth: { token }

Server validates token in Socket.IO middleware and attaches
authenticated user context.

## Rooms

user\_`<userId>`{=html} tournament\_`<tournamentId>`{=html}
round\_`<roundId>`{=html} group\_`<groupId>`{=html}

Rooms are subscriptions, not permissions.

## Joining

Server or authorized client actions establish room membership only after
validating access.

## Event categories

### Server → client

announcement notification chat_message leaderboard_update result_update
room_update group_status round_status tournament_status
tournament_completed

### Client → server

join_tournament join_group send_message request_room_update (only where
needed) Privileged actions may use REST rather than sockets; if socket
actions exist, they invoke the same services as REST.

## Event flow

Mutation: Client → REST/service or authorized socket action → service
validates rules → MySQL transaction → commit → Socket.IO emit → clients
update state

Never emit a successful domain event before the transaction has
committed.

## State merging

Arrays must use functional updates: setItems(prev =\> \[newItem,
...prev\])

Do not replace existing history with a single socket payload.

## Listener cleanup

Every useEffect that registers a listener must remove the same named
handler: socket.on(event, handler) return () =\> socket.off(event,
handler)

Avoid anonymous handlers when cleanup identity matters.

## Reconnection

On reconnect: - socket re-authenticates - client/server restore
authorized room subscriptions - initial state may be refetched where
necessary - duplicate listeners must not be created

## Notifications

Chat messages never generate global notification entries.

## Security

Never trust a client-provided room membership or userId. Resolve
identity from authenticated socket context and validate resource access.

## Scalability

If multiple Socket.IO instances are deployed, introduce a compatible
shared adapter/pub-sub layer. Do not add this dependency until
horizontal scaling is actually required.

------------------------------------------------------------------------

# 01-architecture/lifecycle-state-machines.md

# EVOQ Lifecycle State Machines

## Tournament

DRAFT → REGISTRATION_OPEN → REGISTRATION_CLOSED → LIVE → COMPLETED

Allowed transition ownership: - DRAFT → REGISTRATION_OPEN: organizer
owner - REGISTRATION_OPEN → REGISTRATION_CLOSED: organizer owner -
REGISTRATION_CLOSED → LIVE: organizer/system according to configured
start workflow - LIVE → COMPLETED: organizer owner after final-round
completion

No reverse transitions. No writes after COMPLETED.

## Round

NOT_STARTED → IN_PROGRESS → COMPLETED

A round cannot complete unless required groups are complete and
qualification decisions are finalized according to the round workflow.

## Group

NOT_STARTED → IN_PROGRESS → COMPLETED

A group cannot complete until all required matches are complete and its
leaderboard is finalized.

## Match

Recommended: SCHEDULED → LIVE → COMPLETED

A completed match cannot accept new results unless an explicit
correction workflow is later designed.

## Registration

PENDING → VERIFIED or PENDING → REJECTED

A verified registration becomes eligible for group assignment.

## Completion invariant

Tournament COMPLETED implies: - final round COMPLETED - final
leaderboard finalized - archive snapshot created - transient cleanup
succeeded or is safely deferred according to the cleanup job policy -
all mutation endpoints reject further writes

## Enforcement

State transitions are implemented in services and protected by
transactions. Controllers and sockets cannot bypass service-level
transition rules.

------------------------------------------------------------------------

# 01-architecture/security-architecture.md

# EVOQ Security Architecture

## Authentication

-   bcrypt or equivalent password hashing
-   JWT access tokens
-   secure token handling
-   expiration and invalid-token handling

## Authorization

Role + ownership + resource access + lifecycle checks.

## SQL security

Use mysql2 parameterized queries. Never concatenate user input into SQL.

## Validation

Validate: - body - params - query - file metadata - enum values -
numeric ranges - dates - team sizes - registration state transitions

## File uploads

For payment screenshots and match-result images: - allowlist MIME/type
and extension - size limit - safe generated filename - never trust
original filename - store outside executable paths - restrict access -
delete during cleanup when permitted

## Sensitive data

Never return: - password_hash - internal secrets - private payment
evidence to unauthorized users - stack traces in production

## Rate limiting

Apply to: - login - signup - sensitive mutations - high-volume chat
where appropriate

## CORS

Explicitly configure allowed origins from environment configuration.

## Headers

Use secure HTTP headers and appropriate content/security policies.

## Logging

Structured logs should contain: - request id - route - user id when
available - resource id - event type - duration - error classification

Do not log passwords, JWTs, payment screenshots or sensitive personal
data.

## Socket security

JWT authentication at handshake. Every action validates authorization.
Reject unauthorized room access and privileged actions.

## Completion lock

Every tournament mutation path checks lifecycle status. This includes
REST, Socket.IO, background jobs and internal service calls.

------------------------------------------------------------------------

# 01-architecture/file-upload-architecture.md

# EVOQ File Upload Architecture

## Upload categories

1.  Tournament payment proof
2.  Match result screenshots/media

## Requirements

-   MIME allowlist
-   extension allowlist
-   size limits
-   generated storage keys
-   metadata in database
-   authorization checks
-   private access by default

## Payment evidence

Payment proof is attached to a registration and is visible to authorized
tournament organizers.

## Match result media

Media is attached to a match result. It remains available during the
live tournament according to product requirements.

## Cleanup

On tournament completion, archive only lightweight required information.
Delete temporary files after the archive transaction is safely
committed.

## Failure handling

If database persistence fails, do not leave an orphaned upload. If
upload succeeds but DB transaction fails, cleanup the orphaned file. If
cleanup fails after completion, record a retryable cleanup job/state
rather than silently losing the archive.

------------------------------------------------------------------------

# 01-architecture/archive-cleanup-architecture.md

# EVOQ Archive and Cleanup Architecture

## Goal

Minimize persistent storage while preserving tournament history.

## Archive snapshot

Before deleting live data, create a lightweight archive containing: -
tournament identity - completion date - registration count - final
leaderboard - winners - qualified teams by round - configured final
summary statistics

## Transaction boundary

The database portion must be transactional: 1. lock/validate tournament
2. verify finalization invariants 3. build archive snapshot 4. insert
archive 5. mark tournament completed 6. delete eligible relational
transient data 7. commit

File deletion may require a post-commit cleanup step because
filesystem/object-storage operations are not inherently part of a MySQL
transaction.

## Important rule

Do not delete live data until all required history has been captured.

## Retention

Permanent: - users/player identities - reusable teams - archive
snapshots - other compliance-required records

Temporary: - group chat - notifications - announcements - room
credentials - live leaderboard records - live match results and
screenshots, subject to final archive requirements

The exact deletion list must be validated against the final archive
schema before production.

## Recovery

A failed cleanup must be retryable. Never make a second completion
action create duplicate archive records. Use unique tournament_id in
archive.

## History deletion

Organizer/admin deletion of history must require explicit authorization
and should be irreversible only after confirmation and safe dependency
checks.

------------------------------------------------------------------------

# 02-ui/design-system.md

# EVOQ UI Design System

## Visual direction

Professional esports control platform. Visual language should
communicate: - competition - technology - live operations - clarity

Avoid excessive animation and decorative effects that reduce usability.

## Technology

React + normal CSS. No Tailwind. No Bootstrap. Prefer CSS Modules or a
clearly scoped modular CSS architecture.

## Layout

Responsive: - large desktop - desktop/tablet - tablet - mobile - small
mobile

## Core patterns

-   App shell
-   Sidebar
-   Top navigation
-   Page header
-   Cards
-   Tables
-   Tabs
-   Modals
-   Drawers
-   Toast/feedback
-   Empty states
-   Skeleton/loading states
-   Error states
-   Permission states

## Tables

Tables live inside overflow containers on narrow screens. Never cause
page-level horizontal scrolling.

## Forms

Stack fields on narrow screens. Use accessible labels and validation
messages.

## Touch

Interactive controls should have comfortable touch targets.

## Notification panel

Render at a high-level container/portal so parent overflow and stacking
contexts cannot clip it.

## Accessibility

-   semantic HTML
-   keyboard navigation
-   visible focus
-   labels
-   appropriate ARIA where needed
-   sufficient contrast
-   non-hover-only actions

## State presentation

Every data-driven page supports: - loading - populated - empty -
validation error - API error - permission denied - network failure

------------------------------------------------------------------------

# 02-ui/page-inventory.md

# EVOQ Page Inventory

## Public

-   Landing
-   Login
-   Signup

## Player

-   Dashboard
-   Profile
-   Teams
-   Create Team
-   Team Details
-   Explore Tournaments
-   Tournament Details/Registration
-   My Tournaments
-   Communications Hub
-   Notifications
-   History

## Organizer

-   Dashboard
-   Create Tournament
-   Tournament Overview
-   Edit Tournament
-   Registrations
-   Registration Detail
-   Rounds
-   Groups
-   Group Detail
-   Match Management
-   Results
-   Leaderboard
-   Announcements
-   Tournament Settings
-   Completion/Finalization
-   History

## Optional Admin

-   User administration
-   Tournament oversight
-   Operational monitoring

## Communications Hub

Tabs: - Overview - Announcements - Groups - Leaderboard - Results - Chat

## Page implementation rule

Every page must define: - route - role access - data dependencies - API
calls - socket subscriptions - loading state - empty state - error
state - mobile behavior - acceptance criteria

------------------------------------------------------------------------

# 02-ui/navigation.md

# EVOQ Navigation Architecture

## Public

/ /login /signup

## Player

/player/dashboard /player/profile /player/teams /player/teams/new
/player/teams/:teamId /player/tournaments
/player/tournaments/:tournamentId /player/tournaments/:tournamentId/hub
/player/history

## Organizer

/organizer/dashboard /organizer/tournaments/new
/organizer/tournaments/:tournamentId
/organizer/tournaments/:tournamentId/edit
/organizer/tournaments/:tournamentId/registrations
/organizer/tournaments/:tournamentId/rounds
/organizer/tournaments/:tournamentId/rounds/:roundId/groups
/organizer/tournaments/:tournamentId/groups/:groupId
/organizer/tournaments/:tournamentId/matches/:matchId
/organizer/tournaments/:tournamentId/announcements
/organizer/tournaments/:tournamentId/leaderboard /organizer/history

## Route rules

-   Route guards prevent unauthorized navigation.
-   Route guards are UX only; APIs enforce real authorization.
-   Communications Hub always derives tournamentId from a canonical
    route parameter.
-   Recent Activity navigation must use the same canonical Hub route.

------------------------------------------------------------------------

# 03-development/roadmap.md

# EVOQ Development Roadmap

## Phase 0 --- Architecture Freeze

Deliver: - product requirements - domain model - database design - state
machines - authorization matrix - API contract - realtime contract - UI
inventory - security architecture - archive strategy - test strategy

Exit criteria: All architecture documents reviewed and approved.

## Phase 1 --- Repository Foundation

Deliver: - client/server structure - environment configuration -
lint/build/test commands - MySQL connectivity - Express baseline - React
routing baseline - error handling - logging baseline

## Phase 2 --- Database

Deliver: - migrations - constraints - indexes - seed/test strategy -
rollback strategy

## Phase 3 --- Backend Security/Foundation

Deliver: - auth middleware - validation - role/ownership middleware -
repositories/services/controllers - secure error handling

## Phase 4 --- Auth + Identity

Deliver: - signup/login - profiles - unique player IDs - role handling

## Phase 5 --- Teams

Deliver: - team creation - member lookup - membership - deletion -
authorization

## Phase 6 --- Tournaments + Registration

Deliver: - tournament CRUD - lifecycle registration states - payment
evidence - verification/rejection - export

## Phase 7 --- Competition Engine

Deliver: - rounds - groups - assignments - matches - room data

## Phase 8 --- Results/Leaderboard/Qualification

Deliver: - match results - match/group/round/overall leaderboard -
qualification - next-round eligibility

## Phase 9 --- Realtime

Deliver: - JWT socket auth - rooms - announcements - notifications -
room updates - results/leaderboard updates - chat - reconnect handling

## Phase 10 --- UI/UX

Deliver: - player application - organizer console - communications hub -
responsive layouts

## Phase 11 --- Completion/Archive

Deliver: - finalization - archive snapshot - cleanup - immutable
completed state

## Phase 12 --- Hardening

Deliver: - security audit - automated tests - socket tests -
race-condition tests - responsive tests - performance tests

## Phase 13 --- Production

Deliver: - CI/CD - environment separation - backups - monitoring -
deployment - rollback procedure

## Phase gate

No phase starts until: - previous phase tests pass - architecture
contract remains valid - no critical known regression remains

------------------------------------------------------------------------

# 03-development/ai-agent-rules.md

# EVOQ AI Coding-Agent Rules

## Mission

AI coding agents are implementation assistants, not architecture owners.

## Before changing code

The agent MUST: 1. inspect repository structure 2. inspect relevant
existing files 3. inspect applicable docs 4. identify dependencies 5.
identify conflicts 6. produce an implementation plan 7. only then modify
files

## Source-of-truth priority

1.  Approved product specification
2.  Approved architecture documents
3.  Approved API/database contracts
4.  Current phase specification
5.  Existing code

Existing code is not automatically correct.

## Modification discipline

-   Do not rewrite unrelated files.
-   Do not change technology stack without approval.
-   Do not introduce dependencies without justification.
-   Do not duplicate business logic.
-   Do not add dummy production data.
-   Do not bypass services with direct SQL from controllers.
-   Do not put large business workflows inside React components.
-   Do not create a second Socket.IO client.
-   Do not add frontend-only authorization.

## Required implementation output

After work: - files changed - schema/migration changes - API changes -
tests added - tests executed - failures - known limitations -
architecture concerns

## Required testing

Every feature must include appropriate unit/integration tests. Critical
workflows require API integration tests. Realtime features require
socket tests. Lifecycle changes require negative
authorization/state-transition tests.

## Stop conditions

The agent must stop and ask for approval if: - requested change
conflicts with a source-of-truth rule - schema change could break
existing contracts - security boundary is ambiguous - data deletion
could cause irreversible loss - new external dependency is required but
not approved - architecture needs to change beyond the current phase

------------------------------------------------------------------------

# 03-development/definition-of-done.md

# EVOQ Definition of Done

A feature is Done only when:

## Product

-   requirement is implemented exactly
-   edge cases are defined
-   empty/error states exist

## Backend

-   route/controller/service/repository responsibilities are separated
-   validation exists
-   authorization exists
-   lifecycle checks exist
-   transactions are used where required
-   errors are handled consistently

## Database

-   migration exists
-   foreign keys are correct
-   indexes are appropriate
-   uniqueness constraints are defined
-   rollback/recovery is considered

## Frontend

-   real API data is used
-   no production dummy data
-   loading/empty/error/permission states exist
-   responsive behavior is implemented
-   reusable components are used

## Realtime

-   event contract is documented
-   correct rooms are used
-   authorization is verified
-   state merges safely
-   listeners are cleaned up
-   reconnect behavior is tested

## QA

-   unit tests where appropriate
-   integration tests for critical API paths
-   negative tests for authorization
-   regression checks
-   mobile checks where relevant

## Code quality

-   no debug console logs
-   no dead code
-   no unused imports/dependencies
-   no unexplained magic values
-   no duplicated business logic

## Documentation

Relevant API/schema/architecture docs are updated.

## Release gate

No critical or high-severity defect remains open.

------------------------------------------------------------------------

# 04-testing/test-strategy.md

# EVOQ Test Strategy

## Test layers

### Unit

Test: - state machines - validation - qualification logic - leaderboard
aggregation - permission helpers - archive snapshot generation

### API integration

Test: - authentication - team creation/deletion - registration -
tournament lifecycle - round/group/match operations - results -
leaderboards - completion - archive

### Socket

Test: - JWT rejection - room authorization - announcement broadcast -
chat broadcast - notification delivery - leaderboard/result updates -
reconnect behavior - duplicate listener prevention

### Frontend

Use React Testing Library or equivalent for: - route guards - forms -
loading/error/empty states - critical state updates - Hub navigation -
notification behavior

### End-to-end

Critical path: signup → team → tournament discovery → registration →
verification → group → match → result → leaderboard → qualification →
next round → completion → history

## Responsive test widths

At minimum: 320 480 768 1024 1440

## Browser coverage

At minimum: Chrome Firefox Safari mobile browser

## Security tests

-   invalid JWT
-   expired JWT
-   wrong role
-   wrong owner
-   wrong group
-   completed tournament mutation
-   unauthorized file access
-   malformed input
-   SQL injection attempts
-   rate-limit behavior

## Data integrity tests

-   duplicate registration
-   duplicate team membership
-   duplicate match
-   duplicate result
-   conflicting group assignment
-   incomplete round completion
-   duplicate tournament completion
-   failed archive transaction

## Performance

Measure: - API latency - database query time - socket event volume -
memory usage - listener count - concurrent group activity

------------------------------------------------------------------------

# 04-testing/acceptance-criteria.md

# EVOQ Acceptance Criteria

## Authentication

-   valid users can login
-   invalid credentials fail safely
-   protected APIs reject unauthenticated requests
-   role restrictions are enforced

## Teams

-   team owner can create/delete
-   member IDs resolve to real users
-   invalid IDs fail validation
-   non-owner deletion returns 403
-   no orphaned memberships/registrations remain

## Registration

-   tournament-specific filtering works
-   team cannot register twice
-   invalid team size fails
-   paid registration captures payment evidence
-   organizer sees every member
-   export contains every member

## Tournament engine

-   organizer can create rounds
-   multiple groups can exist in one round
-   groups contain only eligible teams
-   each match remains independent
-   room credentials update in realtime

## Qualification

-   group completion is enforced
-   round completion requires completed groups
-   organizer can select qualifiers
-   next round exposes only qualified teams

## Realtime

-   announcement appears without refresh
-   old announcements remain
-   chat appears without refresh
-   chat creates no notification
-   notifications update correctly
-   reconnect restores subscriptions
-   no duplicate events occur

## Completion

-   final leaderboard is produced
-   completion locks all mutation APIs
-   UI switches to archive/read-only mode
-   archive is created
-   transient cleanup is executed safely
-   duplicate completion is prevented

## Responsive

-   no page-level horizontal scroll
-   sidebar collapses
-   tables remain usable
-   forms fit mobile
-   modals remain accessible

## Production

-   build succeeds
-   tests pass
-   secrets are environment-based
-   backups are configured
-   logging/monitoring are active
-   deployment and rollback procedures are documented

------------------------------------------------------------------------

# 04-testing/regression-checklist.md

# EVOQ Regression Checklist

## Auth

-   [ ] signup
-   [ ] login
-   [ ] logout
-   [ ] invalid token
-   [ ] role guard

## Teams

-   [ ] create
-   [ ] member lookup
-   [ ] view
-   [ ] delete owner
-   [ ] delete non-owner denied

## Registration

-   [ ] tournament scope
-   [ ] duplicate prevention
-   [ ] payment evidence
-   [ ] verification
-   [ ] rejection
-   [ ] complete member view
-   [ ] export

## Tournament

-   [ ] create
-   [ ] edit in valid state
-   [ ] open registration
-   [ ] close registration
-   [ ] start live state

## Round/group

-   [ ] create round
-   [ ] create multiple groups
-   [ ] assign teams
-   [ ] prevent unauthorized assignment
-   [ ] room credentials
-   [ ] group completion

## Match

-   [ ] create match
-   [ ] upload result
-   [ ] complete match
-   [ ] ensure Match 1 result is not overwritten by Match 2

## Leaderboard

-   [ ] match
-   [ ] group
-   [ ] round
-   [ ] overall
-   [ ] realtime update

## Qualification

-   [ ] select
-   [ ] persist
-   [ ] next round eligibility
-   [ ] reject unqualified team

## Communications

-   [ ] announcement persistence
-   [ ] announcement realtime
-   [ ] notification
-   [ ] no chat notification
-   [ ] chat realtime
-   [ ] chat history

## Completion

-   [ ] final round
-   [ ] final leaderboard
-   [ ] archive
-   [ ] cleanup
-   [ ] API lock
-   [ ] UI lock
-   [ ] archive view

## Responsive

-   [ ] 320px
-   [ ] 480px
-   [ ] 768px
-   [ ] 1024px
-   [ ] 1440px

## Production

-   [ ] environment variables
-   [ ] database backup
-   [ ] logging
-   [ ] monitoring
-   [ ] build
-   [ ] tests
-   [ ] deployment
-   [ ] rollback
