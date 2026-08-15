# EVOQ User Roles

## Player

Can: - manage own profile - create teams - view own teams - delete teams
they own - register eligible teams - view their tournament
participation - access assigned groups - view allowed tournament data -
use group chat for assigned groups - receive notifications - view
leaderboards/results

Cannot: - create tournament structure - approve registrations - manage
another organizer's tournament - access another group's restricted
information - modify completed tournaments

## Organizer

Can: - create tournaments - manage own tournaments - configure
registrations - verify/reject registrations - inspect all registered
members - create rounds/groups/matches - assign eligible teams - manage
room information - upload results - update leaderboards - select
qualifiers - publish announcements - participate in group chat -
complete rounds/tournaments

Organizer authority is always scoped to tournaments they own.

## Admin

The existing analysis assumes a system-admin role. If implemented, Admin
can oversee system-wide data and operational controls. Admin permissions
must be explicitly specified before exposing destructive/global actions.

## Authorization model

Every protected operation evaluates: 1. authenticated identity 2. role
3. resource ownership or participant access 4. tournament lifecycle 5.
group access where relevant 6. operation-specific business rules
