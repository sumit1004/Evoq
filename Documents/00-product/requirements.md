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
