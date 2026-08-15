# EVOQ File Upload Architecture

## Upload categories

1.  Tournament payment proof
2.  Match result screenshots/media

## Requirements

-   MIME allowlist
-   extension allowlist
-   size limits
-   generated storage keys
-   metadata in database
-   authorization checks
-   private access by default

## Payment evidence

Payment proof is attached to a registration and is visible to authorized
tournament organizers.

## Match result media

Media is attached to a match result. It remains available during the
live tournament according to product requirements.

## Cleanup

On tournament completion, archive only lightweight required information.
Delete temporary files after the archive transaction is safely
committed.

## Failure handling

If database persistence fails, do not leave an orphaned upload. If
upload succeeds but DB transaction fails, cleanup the orphaned file. If
cleanup fails after completion, record a retryable cleanup job/state
rather than silently losing the archive.
