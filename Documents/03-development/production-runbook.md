# EVOQ Production Runbook

## Environment

Use separate environment values for development, staging, and production. Never commit `.env` files or secrets. Production requires `JWT_SECRET`, `DB_HOST`, `DB_USER`, and `DB_NAME`; use a secret manager for the JWT and database password.

## Release

1. Merge the reviewed change to the protected production branch.
2. Wait for the CI workflow to pass lint, tests, and builds.
3. Build the client and server artifacts with `npm ci && npm run build`.
4. Run `npm run db:migrate` against the release database before starting application workers.
5. Start the server with `npm run start --workspace server` under a process supervisor.
6. Serve the client build from the approved static host and configure `/api` and Socket.IO to the API origin.
7. Run `ops/healthcheck.ps1` or an equivalent monitor against `/api/health/ready`.

## Backups

Run `ops/backup-mysql.sh` on a scheduled host with database credentials injected through the environment. Store encrypted backups outside the application host and periodically test restoration with `ops/restore-mysql.sh` in an isolated database.

## Rollback

1. Stop rollout and preserve logs and the failing release identifier.
2. Route traffic to the previous application release.
3. If the migration is backward-compatible, leave it applied and roll back application code.
4. Only use `npm run db:rollback` after an approved database rollback review and a verified backup.
5. Restore the previous client artifact and rerun readiness checks.

The server handles `SIGTERM` and `SIGINT` gracefully so existing requests can finish before shutdown.

## Monitoring

Monitor HTTP 5xx/429 rates, `/api/health/ready`, database connectivity, process restarts, upload disk usage, Socket.IO connection errors, and backup success. Do not log JWTs, passwords, payment evidence, or result media.
