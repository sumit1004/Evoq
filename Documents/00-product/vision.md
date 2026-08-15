# EVOQ Product Vision

## Product

EVOQ is a production-grade esports tournament management platform for
players, teams, and tournament organizers.

## Core proposition

EVOQ combines tournament control and player communications into one
real-time platform.

The organizer controls: - tournament configuration - registrations -
rounds - groups - matches - rooms - results - leaderboards -
qualification - announcements - tournament completion

Players use EVOQ to: - manage profiles - create and manage teams -
discover tournaments - register teams - access assigned groups - receive
tournament information - view rooms, results and leaderboards -
communicate through group chat - receive relevant notifications

## Competition model

EVOQ is designed primarily for team-based tournaments with: - multiple
teams - multiple rounds - multiple groups per round - multiple teams per
group - multiple matches per group - organizer-controlled qualification

There is no bracket tree and no configurable 1v1/3v3/5v5
competition-format engine in the current product definition.

## Product principles

1.  Database is authoritative.
2.  Business rules are enforced server-side.
3.  Realtime updates never replace persistence.
4.  Completed tournaments are immutable.
5.  AI agents must follow the architecture contract.
6.  Every feature must be testable and observable.
7.  Production UI uses real backend data or explicit empty states.
8.  Temporary tournament data is retained only as long as required.

## Primary users

-   Player
-   Tournament Organizer
-   System Admin (administrative role is assumed in the existing
    analysis and must remain explicitly defined if implemented).

## Source basis

This document consolidates the supplied EVOQ product specification and
uploaded rebuild analysis documents. The uploaded documents identify
realtime, lifecycle, registration, leaderboard/result, responsive UI,
cleanup and security issues that the rebuild must address.
