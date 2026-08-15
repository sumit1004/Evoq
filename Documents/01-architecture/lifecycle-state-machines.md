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
