# EVOQ System Architecture

## High-level architecture

React/Vite Client → REST API / Socket.IO → Express Application →
Controllers → Services → Repositories → MySQL

Socket.IO is a realtime transport layered over the same service/domain
logic.

## Backend layers

### Routes

Define HTTP contracts and middleware composition.

### Controllers

Translate HTTP requests into service calls and HTTP responses.
Controllers do not contain large business workflows.

### Services

Contain business rules, lifecycle transitions and transaction
orchestration.

### Repositories

Contain MySQL queries and persistence operations. Use parameterized
queries.

### Middleware

-   authentication
-   role authorization
-   ownership authorization
-   tournament access
-   validation
-   rate limiting where required
-   error handling

### Sockets

Socket handlers: - authenticate socket - validate action - invoke
services - emit persisted results

Socket handlers should not duplicate business logic already in services.

## Frontend layers

Pages → feature components → hooks/context → API services →
SocketContext → backend

Contexts should exist only for genuinely shared state. Avoid global
state for page-local data.

Recommended contexts: - AuthContext - SocketContext -
NotificationContext - optional AnnouncementContext/ChatContext where
shared across a hub

## Source of truth

Database/service state is authoritative. Socket events communicate state
changes. Frontend optimistic updates should not bypass server validation
for critical tournament operations.

## Repository structure

client/src: - app - components - pages - layouts - contexts - hooks -
services - utils - styles - routes

server/src: - config - routes - controllers - services - repositories -
middleware - validators - sockets - utils

database: - migrations - seeds - schema

docs: - product - architecture - ui - development - testing
