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
