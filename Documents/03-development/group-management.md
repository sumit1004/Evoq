# Group Management

Groups belong to one round and use `NOT_STARTED → IN_PROGRESS → COMPLETED`. Assignment is transactional, locks the group, enforces capacity, rejects duplicate round assignment, and accepts only verified Round 1 registrations or persisted previous-round qualifiers. Group reads expose room data only to the tournament organizer or assigned group members.
