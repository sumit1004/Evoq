# Round Management

Rounds are owned by a tournament and use `NOT_STARTED → IN_PROGRESS → COMPLETED`. Creation is sequential within a tournament; a later round requires the previous round to be completed. Round mutation services validate organizer ownership and tournament lifecycle state.

Primary endpoints: `GET/POST /api/tournaments/:tournamentId/rounds`, `PATCH /api/rounds/:roundId`, `POST /api/rounds/:roundId/complete`, and `GET /api/rounds/:roundId/eligible-teams`.
