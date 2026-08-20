import { pool } from '../src/config/database.js';

try {
  const [rows] = await pool.query('SELECT id, name, email, role FROM users');
  console.log('Current Users in DB:');
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
} catch (e) {
  console.error(e);
  process.exit(1);
}
