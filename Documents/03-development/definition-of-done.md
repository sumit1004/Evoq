# EVOQ Definition of Done

A feature is Done only when:

## Product

-   requirement is implemented exactly
-   edge cases are defined
-   empty/error states exist

## Backend

-   route/controller/service/repository responsibilities are separated
-   validation exists
-   authorization exists
-   lifecycle checks exist
-   transactions are used where required
-   errors are handled consistently

## Database

-   migration exists
-   foreign keys are correct
-   indexes are appropriate
-   uniqueness constraints are defined
-   rollback/recovery is considered

## Frontend

-   real API data is used
-   no production dummy data
-   loading/empty/error/permission states exist
-   responsive behavior is implemented
-   reusable components are used

## Realtime

-   event contract is documented
-   correct rooms are used
-   authorization is verified
-   state merges safely
-   listeners are cleaned up
-   reconnect behavior is tested

## QA

-   unit tests where appropriate
-   integration tests for critical API paths
-   negative tests for authorization
-   regression checks
-   mobile checks where relevant

## Code quality

-   no debug console logs
-   no dead code
-   no unused imports/dependencies
-   no unexplained magic values
-   no duplicated business logic

## Documentation

Relevant API/schema/architecture docs are updated.

## Release gate

No critical or high-severity defect remains open.
