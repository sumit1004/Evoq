import { pool } from '../src/config/database.js';

async function test() {
  try {
    console.log('Querying triggers...');
    const [rows] = await pool.query('SHOW TRIGGERS');
    console.log('Triggers:', rows);
  } catch (error) {
    console.error('Failed to show triggers:', error.message);
  }

  process.exit(0);
}

test();
