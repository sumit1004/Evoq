import { runMigrations } from '../src/database/migrationRunner.js';
import { logger } from '../src/utils/logger.js';

try {
  const result = await runMigrations();
  logger.info('database_migrations_complete', { applied: result.applied });
} catch (error) {
  logger.error('database_migrations_failed', { message: error.message });
  process.exitCode = 1;
}
