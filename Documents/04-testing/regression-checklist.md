# EVOQ Regression Checklist

## Auth

-   [ ] signup
-   [ ] login
-   [ ] logout
-   [ ] invalid token
-   [ ] role guard

## Teams

-   [ ] create
-   [ ] member lookup
-   [ ] view
-   [ ] delete owner
-   [ ] delete non-owner denied

## Registration

-   [ ] tournament scope
-   [ ] duplicate prevention
-   [ ] payment evidence
-   [ ] verification
-   [ ] rejection
-   [ ] complete member view
-   [ ] export

## Tournament

-   [ ] create
-   [ ] edit in valid state
-   [ ] open registration
-   [ ] close registration
-   [ ] start live state

## Round/group

-   [ ] create round
-   [ ] create multiple groups
-   [ ] assign teams
-   [ ] prevent unauthorized assignment
-   [ ] room credentials
-   [ ] group completion

## Match

-   [ ] create match
-   [ ] upload result
-   [ ] complete match
-   [ ] ensure Match 1 result is not overwritten by Match 2

## Leaderboard

-   [ ] match
-   [ ] group
-   [ ] round
-   [ ] overall
-   [ ] realtime update

## Qualification

-   [ ] select
-   [ ] persist
-   [ ] next round eligibility
-   [ ] reject unqualified team

## Communications

-   [ ] announcement persistence
-   [ ] announcement realtime
-   [ ] notification
-   [ ] no chat notification
-   [ ] chat realtime
-   [ ] chat history

## Completion

-   [ ] final round
-   [ ] final leaderboard
-   [ ] archive
-   [ ] cleanup
-   [ ] API lock
-   [ ] UI lock
-   [ ] archive view

## Responsive

-   [ ] 320px
-   [ ] 480px
-   [ ] 768px
-   [ ] 1024px
-   [ ] 1440px

## Production

-   [ ] environment variables
-   [ ] database backup
-   [ ] logging
-   [ ] monitoring
-   [ ] build
-   [ ] tests
-   [ ] deployment
-   [ ] rollback
