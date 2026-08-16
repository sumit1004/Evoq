import { asyncHandler } from '../utils/asyncHandler.js';
import { getReadinessStatus } from '../services/healthService.js';

export function getHealth(_req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'evoq-api',
  });
}

export const getReadiness = asyncHandler(async (_req, res) => {
  const result = await getReadinessStatus();

  res.status(result.status === 'ready' ? 200 : 503).json(result);
});
