import { pool } from '../config/database.js';

export async function isDatabaseAvailable() {
  const [rows] = await pool.query('SELECT 1 AS ok');
  return rows[0]?.ok === 1;
}
