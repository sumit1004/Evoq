# Registration Management

Registration APIs are always scoped by `tournamentId` and validate organizer ownership. Organizer list requests support `status`, `search`, `page`, and `limit`; pagination is applied to registration IDs before member rows are joined so a team is never split across pages. Review is a conditional `PENDING` transition. Payment evidence is served only through the authorized registration endpoint. `.xlsx` export is generated server-side with one row per member.

Primary endpoints: `GET /api/tournaments/:tournamentId/registrations`, `GET /api/registrations/:registrationId`, `PATCH /api/registrations/:registrationId`, and `GET /api/tournaments/:tournamentId/registrations/export.xlsx`.
