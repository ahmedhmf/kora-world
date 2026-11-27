/**
 * Read-only readiness check for the supplier EGP pilot. Never starts NestJS.
 * Refuses any DB other than local kora_test.
 */
const path = require('node:path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const host = process.env.DATABASE_HOST || '127.0.0.1';
const database = process.env.DATABASE_NAME;
const user = process.env.DATABASE_USER || process.env.DB_USER;
const password = process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD;
const port = Number(process.env.DATABASE_PORT || 5432);

if (database !== 'kora_test' || !['localhost', '127.0.0.1', '::1'].includes(host) ||
    !user || !password || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('REFUSING: set valid local DATABASE_NAME=kora_test and PostgreSQL credentials');
}

async function run() {
  const client = new Client({ host, database, port, user, password,
    application_name: 'kora_supplier_pilot_readiness' });
  await client.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows: [identity] } = await client.query(
      "SELECT current_database() AS name, current_setting('transaction_read_only') AS readonly",
    );
    if (identity.name !== 'kora_test' || identity.readonly !== 'on') {
      throw new Error('Actual database identity or read-only mode did not match');
    }
    const tables = await client.query(
      "SELECT to_regclass('public.accounting_accounts') IS NOT NULL AS accounts, to_regclass('public.journal_entries') IS NOT NULL AS journals, to_regclass('public.payments') IS NOT NULL AS payments, to_regclass('public.invoices') IS NOT NULL AS invoices",
    );
    if (Object.values(tables.rows[0]).some(v => v !== true)) {
      throw new Error('Required accounting tables not present in kora_test');
    }
    const { rows } = await client.query(`
      SELECT a.id, a.code, a.name, a.type, a.currency, a.is_active,
             NOT EXISTS(SELECT 1 FROM accounting_accounts c WHERE c.parent_id = a.id) AS leaf
      FROM accounting_accounts a
      WHERE a.code = '2100' OR (a.code LIKE '11%' AND a.type = 'asset')
      ORDER BY a.code
    `);
    const ap = rows.find(a => a.code === '2100');
    const banks = rows.filter(a => a.code.startsWith('11') && a.type === 'asset');
    const good = a => a && a.currency.toUpperCase() === 'EGP' && a.is_active && a.leaf;
    console.log('Database:', identity.name, '| read only:', identity.readonly);
    console.log('AP 2100:', ap ? {
      code: ap.code, type: ap.type, currency: ap.currency,
      active: ap.is_active, leaf: ap.leaf,
    } : 'MISSING');
    console.log('11xx cash/bank account count:', banks.length);
    console.log('Eligible EGP bank account count:', banks.filter(good).length);
    if (!ap || ap.type !== 'liability' || !good(ap)) {
      console.log('NOT READY: AP 2100 must be an active leaf EGP liability account; do not change live accounts automatically.');
    } else if (!banks.some(good)) {
      console.log('NOT READY: need an active leaf EGP 11xx bank account.');
    } else {
      console.log('READY: account prerequisites satisfied (not a full integration test).');
    }
    await client.query('ROLLBACK');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    await client.end();
  }
}
run().catch(e => { console.error('Readiness failed:', e.message); process.exitCode = 1; });
