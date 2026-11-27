import pg from 'pg';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';

// Local: reads businessops-ai/.env. On Render: uses the Environment tab.
dotenv.config({path:path.resolve(process.cwd(),'../.env')});
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Add your Neon connection string to .env (local) and Render → Environment.');
}

// Postgres returns NUMERIC and BIGINT (COUNT, SUM) as strings — convert them to JS numbers
pg.types.setTypeParser(1700, v => (v === null ? null : parseFloat(v))); // NUMERIC
pg.types.setTypeParser(20,   v => (v === null ? null : parseInt(v, 10))); // BIGINT

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5
});

// q(...)   → all rows (array)
// one(...) → first row or undefined
export const q   = async (text, params = []) => (await pool.query(text, params)).rows;
export const one = async (text, params = []) => (await pool.query(text, params)).rows[0];

// Runs several queries as one all-or-nothing unit
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export function audit(businessId, userId, action, entity, entityId, details = '') {
  pool.query(
    'INSERT INTO audit_logs(business_id,user_id,action,entity,entity_id,details) VALUES($1,$2,$3,$4,$5,$6)',
    [businessId, userId, action, entity, entityId, details]
  ).catch(() => {});
}

// Creates any missing tables/columns using database/neon-schema.sql (safe to run every start)
export async function initDb() {
  const schemaPath = path.resolve(__dirname, '../../database/neon-schema.sql');
  if (fs.existsSync(schemaPath)) {
    await pool.query(fs.readFileSync(schemaPath, 'utf8'));
    console.log('Neon schema checked ✓');
  } else {
    console.warn('neon-schema.sql not found at', schemaPath, '— skipping schema setup');
  }
  await pool.query('SELECT 1');
  console.log('Connected to Neon ✓');
}