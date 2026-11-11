/**
 * LOCAL kora_test ONLY. Explicit, one-time schema preparation for the pilot.
 * This file is deliberately OUTSIDE src/migrations because AppModule enables
 * migrationsRun automatically. It never runs on application startup.
 *
 * Run: DATABASE_NAME=kora_test DATABASE_HOST=127.0.0.1 node scripts/prepare-supplier-request-key-test-db.js
 */
const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('node:path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const host = process.env.DATABASE_HOST;
const database = process.env.DATABASE_NAME;
const port = Number(process.env.DATABASE_PORT || 5432);
const user = process.env.DATABASE_USER || process.env.DB_USER;
const password = process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD;

if (database !== 'kora_test' || !['localhost', '127.0.0.1', '::1'].includes(host) ||
    !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password) {
  throw new Error('REFUSING schema change: require explicit local DATABASE_NAME=kora_test, loopback DATABASE_HOST and credentials');
}
async function main() {
  const client = new Client({ host, database, port, user, password,
    application_name: 'kora_test_supplier_request_key_schema' });
  await client.connect();
  try {
    await client.query('BEGIN');
    const { rows: [identity] } = await client.query(
      "SELECT current_database() AS db, current_setting('transaction_read_only') AS readonly",
    );
    if (identity.db !== 'kora_test' || identity.readonly !== 'off') {
      throw new Error('REFUSING: wrong database or connection not writable');
    }
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS request_key uuid NULL");
    // UNIQUE allows unlimited NULLs for untouched legacy payments.
    await client.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_request_key ON public.payments (request_key) WHERE request_key IS NOT NULL',
    );
    const { rows: [verification] } = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='payments'
          AND column_name='request_key' AND data_type='uuid' AND is_nullable='YES'
      ) AS column_ready,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname='public' AND tablename='payments'
          AND indexname='uq_payments_request_key'
          AND indexdef ILIKE '%UNIQUE INDEX%'
      ) AS unique_index_ready
    `);
    if (!verification.column_ready || !verification.unique_index_ready) {
      throw new Error('Request key schema verification failed');
    }
    await client.query('COMMIT');
    console.log('Local kora_test prepared: nullable payments.request_key UUID with unique partial index.');
    console.log('No historical payment rows were modified.');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw error;
  } finally {
    await client.end();
  }
}
main().catch(error => { console.error('Test schema preparation failed:', error.message); process.exitCode = 1; });
