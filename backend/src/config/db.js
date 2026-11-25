import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const requiredSettings = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missingSettings = requiredSettings.filter((setting) => !process.env[setting]);

if (missingSettings.length > 0) {
  throw new Error(`Configure ${missingSettings.join(', ')} in backend/.env before starting the backend.`);
}

if (process.env.DB_PASSWORD === 'your-local-password') {
  throw new Error('Replace DB_PASSWORD in backend/.env with the password for the dedicated MySQL application user.');
}

const port = Number(process.env.DB_PORT || 3306);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('DB_PORT must be a valid TCP port number.');
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  supportBigNumbers: true,
  bigNumberStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const runQuery = async (executor, text, params = []) => {
  const [result, fields] = await executor.query(text, params);
  return {
    rows: Array.isArray(result) ? result : [],
    insertId: result.insertId ?? null,
    affectedRows: result.affectedRows ?? 0,
    fields,
  };
};

export const query = (text, params = []) => runQuery(pool, text, params);

export const withTransaction = async (callback) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback((text, params = []) => runQuery(connection, text, params));
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], 'MySQL transaction and rollback both failed.');
    }
    throw error;
  } finally {
    connection.release();
  }
};

export const connectDB = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('MySQL connected');
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
};

export default pool;
