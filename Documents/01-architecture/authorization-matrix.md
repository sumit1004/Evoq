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
