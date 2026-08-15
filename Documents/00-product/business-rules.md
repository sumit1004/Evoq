# EVOQ Business Rules

1.  Teams are reusable entities and are not owned by a single
    tournament.
2.  Registration is the tournament participation record for a team.
3.  A team cannot register twice for the same tournament.
4.  Only valid team members may be included in a registration.
5.  Paid registrations require payment evidence before verification.
6.  Only VERIFIED registrations are eligible for group assignment.
7.  Only teams eligible for a round may be assigned to its groups.
8.  A player can access a group only through membership in an assigned
    team or authorized organizer access.
9.  Match results are scoped to a specific match.
10. Leaderboard entries are scoped to a specific match/group/round as
    defined by the schema.
11. A round cannot complete until its required groups are complete.
12. Qualification is controlled by the organizer and stored explicitly.
13. Only qualified teams can enter the next round.
14. A completed tournament cannot be modified.
15. Backend APIs must enforce the completed-tournament lock.
16. Socket actions must also enforce authorization and lifecycle rules.
17. Announcements append to existing history.
18. Chat messages do not create notifications.
19. Notifications are user-specific and generated only for configured
    tournament events.
20. Registration queries must always be tournament-scoped.
21. History must survive deletion of transient live data.
22. Archive cleanup must be transactional.
23. File uploads must be validated for type and size.
24. No production flow uses dummy users, teams, registrations, results
    or leaderboards.
25. AI-generated code must not silently change these rules.
