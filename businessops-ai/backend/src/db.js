import pg from 'pg';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from businessops-ai/.env or current/parent directory
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool, types } = pg;

// Parse PostgreSQL NUMERIC (1700) and INT8/BIGINT (20) as JS numbers
// so aggregates (COUNT, SUM) and monetary/quantity fields match prior numeric API types.
types.setTypeParser(1700, (val) => (val === null ? null : Number(val)));
types.setTypeParser(20, (val) => (val === null ? null : Number(val)));

const connectionString = process.env.DATABASE_URL;

function shouldUseSsl(url) {
  if (!url) return false;
  if (process.env.DB_SSL === 'false' || url.includes('sslmode=disable')) return false;
  return (
    url.includes('neon.tech') ||
    url.includes('sslmode=require') ||
    process.env.DB_SSL === 'true' ||
    process.env.NODE_ENV === 'production'
  );
}

export const pool = new Pool({
  connectionString,
  ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : false,
  max: Number.parseInt(process.env.PG_POOL_MAX || '10', 10),
  idleTimeoutMillis: Number.parseInt(process.env.PG_IDLE_TIMEOUT_MS || '30000', 10),
  connectionTimeoutMillis: Number.parseInt(process.env.PG_CONNECTION_TIMEOUT_MS || '10000', 10),
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

export const db = {
  query: (text, params = []) => pool.query(text, params),
  async get(text, params = []) {
    const { rows } = await pool.query(text, params);
    return rows[0];
  },
  async all(text, params = []) {
    const { rows } = await pool.query(text, params);
    return rows;
  },
};

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback error
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function audit(businessId, userId, action, entity, entityId, details = '') {
  try {
    await pool.query(
      'INSERT INTO audit_logs(business_id, user_id, action, entity, entity_id, details) VALUES($1, $2, $3, $4, $5, $6)',
      [businessId, userId, action, entity, entityId, details]
    );
  } catch {
    // Audit logging should not break primary request flow
  }
}

export async function initDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set. Configure your Neon PostgreSQL connection string.');
  }

  const schemaPath = path.resolve(__dirname, '../../database/neon-schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    await client.query(schemaSql);
  } finally {
    client.release();
  }
}

export async function checkDbHealth() {
  await pool.query('SELECT 1');
  return true;
}

export async function closeDb() {
  await pool.end();
}
