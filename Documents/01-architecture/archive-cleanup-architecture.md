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
