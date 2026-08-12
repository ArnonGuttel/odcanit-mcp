import { getPool } from '../dist/db.js';

try {
  const pool = await getPool();
  await pool.request().query('SELECT 1');
  console.log('OK');
  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
