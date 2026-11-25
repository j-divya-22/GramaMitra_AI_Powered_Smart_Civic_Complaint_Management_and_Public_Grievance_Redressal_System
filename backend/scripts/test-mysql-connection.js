import { query, default as pool } from '../src/config/db.js';

const expectedTables = [
  'users',
  'complaints',
  'complaint_images',
  'complaint_status_history',
  'complaint_progress_updates',
  'departments',
  'officers',
  'knowledge_documents',
  'chat_history',
  'reward_transactions',
  'reward_redemptions',
  'audit_logs',
];

try {
  const databaseResult = await query('SELECT DATABASE() AS database_name');
  const databaseName = databaseResult.rows[0]?.database_name;
  console.log(`Selected database: ${databaseName}`);

  if (databaseName !== 'gramamitra_db') {
    throw new Error(`Expected database gramamitra_db, received ${databaseName || 'no selected database'}.`);
  }

  const tablesResult = await query('SHOW TABLES');
  const tableNames = tablesResult.rows.map((row) => Object.values(row)[0]);
  const missingTables = expectedTables.filter((table) => !tableNames.includes(table));

  console.log(`Visible tables (${tableNames.length}): ${tableNames.join(', ')}`);
  if (missingTables.length > 0 || tableNames.length !== expectedTables.length) {
    throw new Error(`Expected all 12 schema tables; missing: ${missingTables.join(', ') || 'none'}; found ${tableNames.length}.`);
  }

  console.log('MySQL connection test passed; all 12 expected tables are visible.');
} catch (error) {
  console.error(`MySQL connection test failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
