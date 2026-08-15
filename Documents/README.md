# EVOQ Architecture Freeze

This directory is the canonical engineering blueprint for the EVOQ
production rebuild.

## Purpose

EVOQ is an esports tournament management platform for players, teams and
organizers.

The rebuild must prioritize: - correctness - maintainability -
security - database integrity - realtime reliability - lifecycle
enforcement - testability - responsive UX - controlled data retention

## How to use these documents

AI coding agents must read the relevant documents before modifying code.

Recommended order: 1. product requirements 2. business rules 3. database
schema 4. API contract 5. authorization 6. lifecycle 7. realtime 8.
current phase specification

## Canonical stack

Frontend: - React - Vite - React Router - Axios - Socket.IO Client -
normal CSS

Backend: - Node.js - Express - Socket.IO - JWT - MySQL - mysql2 -
dotenv - cors

## Phase gates

No phase proceeds until: - implementation is complete - tests pass -
acceptance criteria pass - documentation is updated - no critical
regression exists

## Important architecture decisions

-   Teams are reusable and not tournament-owned.
-   Registration connects a team to a tournament.
-   Match is a first-class entity.
-   Tournament completion is immutable.
-   Realtime is transport, not the source of truth.
-   Socket room membership is not authorization.
-   Chat does not generate global notifications.
-   Archive cleanup is transactional for database state and retryable
    for file cleanup.
-   Production flows use real data or explicit empty states.

## Source basis

This package is based on the EVOQ master product specification and the
supplied EVOQ rebuild analysis/Executive Summary documents. Where those
documents contain alternative implementations, this package records the
production architecture chosen for the rebuild rather than preserving
legacy implementation weaknesses.
