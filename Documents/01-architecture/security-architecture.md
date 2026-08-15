# EVOQ Security Architecture

## Authentication

-   bcrypt or equivalent password hashing
-   JWT access tokens
-   secure token handling
-   expiration and invalid-token handling

## Authorization

Role + ownership + resource access + lifecycle checks.

## SQL security

Use mysql2 parameterized queries. Never concatenate user input into SQL.

## Validation

Validate: - body - params - query - file metadata - enum values -
numeric ranges - dates - team sizes - registration state transitions

## File uploads

For payment screenshots and match-result images: - allowlist MIME/type
and extension - size limit - safe generated filename - never trust
original filename - store outside executable paths - restrict access -
delete during cleanup when permitted

## Sensitive data

Never return: - password_hash - internal secrets - private payment
evidence to unauthorized users - stack traces in production

## Rate limiting

Apply to: - login - signup - sensitive mutations - high-volume chat
where appropriate

## CORS

Explicitly configure allowed origins from environment configuration.

## Headers

Use secure HTTP headers and appropriate content/security policies.

## Logging

Structured logs should contain: - request id - route - user id when
available - resource id - event type - duration - error classification

Do not log passwords, JWTs, payment screenshots or sensitive personal
data.

## Socket security

JWT authentication at handshake. Every action validates authorization.
Reject unauthorized room access and privileged actions.

## Completion lock

Every tournament mutation path checks lifecycle status. This includes
REST, Socket.IO, background jobs and internal service calls.
