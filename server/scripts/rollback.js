import { rollbackLastMigration } from '../src/database/migrationRunner.js';
import { logger } from '../src/utils/logger.js';

try {
  const result = await rollbackLastMigration();
  logger.info('database_rollback_complete', { rolledBack: result.rolledBack });
} catch (error) {
  logger.error('database_rollback_failed', { message: error.message });
  process.exitCode = 1;
}
