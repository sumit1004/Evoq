# EVOQ

Production-oriented esports tournament management platform using React/Vite, Express, Socket.IO, JWT, MySQL, and `mysql2`.

## Local development

1. Copy `server/.env.example` to `server/.env` and configure MySQL.
2. Run `npm ci`.
3. Apply migrations with `npm run db:migrate`.
4. Start the API with `npm run dev:server`.
5. Start the client with `npm run dev:client`.

The client is served at `http://localhost:5173` and the API at `http://localhost:4000`.

## Verification

```text
npm run lint
npm test
npm run build
```

Readiness is available at `/api/health/ready`.

Production deployment, backup, restore, and rollback procedures are documented in `Documents/03-development/production-runbook.md`.
