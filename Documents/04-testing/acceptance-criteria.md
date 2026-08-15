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
