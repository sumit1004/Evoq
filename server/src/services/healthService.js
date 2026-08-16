import { isDatabaseAvailable } from '../repositories/healthRepository.js';

export async function getReadinessStatus() {
  const database = await isDatabaseAvailable();
  return {
    status: database ? 'ready' : 'degraded',
    checks: { database },
  };
}
