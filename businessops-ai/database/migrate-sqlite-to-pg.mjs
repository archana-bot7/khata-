import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { pool, initDb, closeDb } from '../backend/src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultSqlitePath = path.resolve(__dirname, '../backend/data/businessops.db');
const sqlitePath = path.resolve(process.argv[2] || process.env.DATABASE_FILE || defaultSqlitePath);

const TABLES_IN_ORDER = [
  {
    name: 'businesses',
    columns: ['id', 'name', 'category', 'currency', 'address', 'phone', 'created_at'],
  },
  {
    name: 'users',
    columns: [
      'id',
      'business_id',
      'name',
      'email',
      'password_hash',
      'role',
      'phone',
      'reset_code',
      'reset_token',
      'reset_expires',
      'created_at',
    ],
  },
  {
    name: 'products',
    columns: [
      'id',
      'business_id',
      'sku',
      'name',
      'category',
      'unit',
      'purchase_price',
      'selling_price',
      'stock',
      'min_stock',
      'archived',
      'created_at',
    ],
  },
  {
    name: 'customers',
    columns: ['id', 'business_id', 'name', 'phone', 'email', 'address', 'created_at'],
  },
  {
    name: 'suppliers',
    columns: ['id', 'business_id', 'name', 'contact', 'phone', 'email', 'address', 'created_at'],
  },
  {
    name: 'sales',
    columns: [
      'id',
      'business_id',
      'invoice_no',
      'customer_name',
      'product_name',
      'price',
      'discount',
      'purchase_price',
      'quantity',
      'total',
      'remarks',
      'status',
      'created_at',
    ],
  },
  {
    name: 'purchases',
    columns: [
      'id',
      'business_id',
      'supplier',
      'product',
      'quantity',
      'unit_cost',
      'total',
      'expected_date',
      'status',
      'created_at',
    ],
  },
  {
    name: 'expenses',
    columns: ['id', 'business_id', 'category', 'description', 'amount', 'date'],
  },
  {
    name: 'payments',
    columns: ['id', 'business_id', 'type', 'amount', 'method', 'note', 'created_at'],
  },
  {
    name: 'notifications',
    columns: ['id', 'business_id', 'title', 'body', 'category', 'read', 'created_at'],
  },
  {
    name: 'audit_logs',
    columns: ['id', 'business_id', 'user_id', 'action', 'entity', 'entity_id', 'details', 'created_at'],
  },
  {
    name: 'invoice_uploads',
    columns: [
      'id',
      'business_id',
      'filename',
      'original_name',
      'mime_type',
      'size',
      'notes',
      'status',
      'created_at',
    ],
  },
];

async function migrate() {
  if (!fs.existsSync(sqlitePath)) {
    console.error(`SQLite database not found at: ${sqlitePath}`);
    process.exit(1);
  }

  console.log(`Initializing PostgreSQL schema...`);
  await initDb();

  const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
  const pgClient = await pool.connect();

  try {
    await pgClient.query('BEGIN');

    for (const table of TABLES_IN_ORDER) {
      const tableExists = sqlite
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table.name}'`)
        .get();

      if (!tableExists) {
        console.log(`Skipping ${table.name} (not present in SQLite)`);
        continue;
      }

      const sqliteCols = sqlite
        .prepare(`PRAGMA table_info(${table.name})`)
        .all()
        .map((c) => c.name);

      const colsToCopy = table.columns.filter((c) => sqliteCols.includes(c));
      if (!colsToCopy.length) continue;

      const rows = sqlite.prepare(`SELECT ${colsToCopy.join(', ')} FROM ${table.name}`).all();
      let inserted = 0;

      for (const row of rows) {
        const placeholders = colsToCopy.map((_, idx) => `$${idx + 1}`).join(', ');
        const values = colsToCopy.map((c) => row[c]);
        const sql = `INSERT INTO ${table.name}(${colsToCopy.join(', ')}) VALUES(${placeholders}) ON CONFLICT DO NOTHING`;
        const res = await pgClient.query(sql, values);
        inserted += res.rowCount || 0;
      }

      // Synchronize identity sequence after explicit ID inserts
      await pgClient.query(
        `SELECT setval(pg_get_serial_sequence('${table.name}', 'id'), COALESCE((SELECT MAX(id) FROM ${table.name}), 1), true)`
      );

      console.log(`Table ${table.name}: ${rows.length} SQLite rows read, ${inserted} new rows inserted into PostgreSQL.`);
    }

    await pgClient.query('COMMIT');
    console.log('Migration completed successfully without overwriting existing PostgreSQL records.');
  } catch (err) {
    await pgClient.query('ROLLBACK');
    console.error('Migration failed and was rolled back:', err);
    process.exitCode = 1;
  } finally {
    pgClient.release();
    sqlite.close();
    await closeDb();
  }
}

migrate();
