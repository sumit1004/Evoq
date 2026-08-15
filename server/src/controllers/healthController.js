import { checkDatabaseConnection } from '../config/database.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export function getHealth(_req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'evoq-api',
  });
}

export const getReadiness = asyncHandler(async (_req, res) => {
  const database = await checkDatabaseConnection();

  res.status(database ? 200 : 503).json({
    status: database ? 'ready' : 'degraded',
    checks: {
      database,
    },
  });
});
