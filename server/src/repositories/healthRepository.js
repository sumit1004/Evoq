import { pingDatabase } from '../config/database.js';

export async function isDatabaseAvailable() {
  const result = await pingDatabase(3000);
  return result.ok;
}

