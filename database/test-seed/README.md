# EVOQ Test Seed Boundary

This directory is reserved for disposable development/test fixtures. It must
never be executed by `db:migrate` and must never contain production secrets.

Phase 02 intentionally provides no fake players, teams, tournaments, or
registrations. Test fixtures will be added with the feature tests that need
them and must target a non-production database.
