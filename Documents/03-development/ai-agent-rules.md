# EVOQ AI Coding-Agent Rules

## Mission

AI coding agents are implementation assistants, not architecture owners.

## Before changing code

The agent MUST: 1. inspect repository structure 2. inspect relevant
existing files 3. inspect applicable docs 4. identify dependencies 5.
identify conflicts 6. produce an implementation plan 7. only then modify
files

## Source-of-truth priority

1.  Approved product specification
2.  Approved architecture documents
3.  Approved API/database contracts
4.  Current phase specification
5.  Existing code

Existing code is not automatically correct.

## Modification discipline

-   Do not rewrite unrelated files.
-   Do not change technology stack without approval.
-   Do not introduce dependencies without justification.
-   Do not duplicate business logic.
-   Do not add dummy production data.
-   Do not bypass services with direct SQL from controllers.
-   Do not put large business workflows inside React components.
-   Do not create a second Socket.IO client.
-   Do not add frontend-only authorization.

## Required implementation output

After work: - files changed - schema/migration changes - API changes -
tests added - tests executed - failures - known limitations -
architecture concerns

## Required testing

Every feature must include appropriate unit/integration tests. Critical
workflows require API integration tests. Realtime features require
socket tests. Lifecycle changes require negative
authorization/state-transition tests.

## Stop conditions

The agent must stop and ask for approval if: - requested change
conflicts with a source-of-truth rule - schema change could break
existing contracts - security boundary is ambiguous - data deletion
could cause irreversible loss - new external dependency is required but
not approved - architecture needs to change beyond the current phase
