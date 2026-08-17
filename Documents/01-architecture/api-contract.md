# EVOQ REST API Contract

All endpoints are under /api.

## Authentication

POST /auth/signup POST /auth/login GET /auth/me POST /auth/logout (if server-side
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
