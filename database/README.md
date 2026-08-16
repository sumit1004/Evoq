# EVOQ Database

Phase 02 provides the versioned MySQL migration in `migrations/`.

## Commands

From the repository root:

```text
npm run db:migrate
npm run db:rollback
```

The migration runner records applied migrations in `schema_migrations` and
executes one version at a time. Rollback uses the matching `.down.sql` file
and removes the migration record only after the down migration succeeds.

MySQL DDL can implicitly commit, so rollback is an explicit recovery path,
not a claim that a failed DDL statement can be transactionally undone. Take a
database backup before rolling back a shared environment.

## Test data

Production migrations contain schema only. Disposable test data must be
created by a separate test harness or an explicitly configured test seed;
there is no automatic production seed.
