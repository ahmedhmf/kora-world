/**
 * Supplier posting diagnostic. READ ONLY; refuses all DBs except local kora_test.
 * Does not start NestJS (which normally runs migrations on startup).
 *
 * PowerShell:
 *   $env:DATABASE_NAME='kora_test'
 *   node scripts/audit-supplier-postings.js
 */
const path = require('node:path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const database = process.env.DATABASE_NAME;
const host = process.env.DATABASE_HOST || '127.0.0.1';
const port = Number(process.env.DATABASE_PORT || 5432);
const user = process.env.DATABASE_USER || process.env.DB_USER;
const password = process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD;

if (database !== 'kora_test' || !['localhost', '127.0.0.1', '::1'].includes(host)) {
  throw new Error('REFUSING: audit requires DATABASE_NAME=kora_test and a loopback DATABASE_HOST');
}
if (!Number.isInteger(port) || port < 1 || port > 65535 || !user || typeof password !== 'string' || !password) {
  throw new Error('Invalid port or missing local test database credentials');
}

const queries = [
  {
    label: 'Supplier invoices and associated payment counts',
    sql: `
      SELECT i.id AS invoice_id, i.number, i.status, i.currency, i.total AS invoice_total,
             COALESCE(p.payment_count,0)::int AS payment_count,
             COALESCE(p.paid_egp,0)::numeric(18,2) AS paid_egp,
             COALESCE(j.journal_count,0)::int AS linked_payment_journals
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, COUNT(*)::int AS payment_count, SUM(amount_egp) AS paid_egp
        FROM payments GROUP BY invoice_id
      ) p ON p.invoice_id = i.id
      LEFT JOIN (
        SELECT invoice_id, COUNT(*)::int AS journal_count
        FROM journal_entries
        WHERE type = 'payment' AND posting_status IN ('posted','reversed')
        GROUP BY invoice_id
      ) j ON j.invoice_id = i.id
      WHERE i.type = 'incoming'
      ORDER BY i.id
    `,
  },
  {
    label: 'Potential paid-invoice double-posting (manual review required)',
    sql: `
      SELECT i.id AS invoice_id, i.number AS invoice_number,
        i.status, COUNT(DISTINCT p.id)::int AS payment_records,
        COUNT(DISTINCT j.id)::int AS payment_journals,
        COUNT(DISTINCT j.id) FILTER (WHERE j.reference = i.number || '-PAY')::int AS synthetic_paid_journals
      FROM invoices i
      LEFT JOIN payments p ON p.invoice_id = i.id
      LEFT JOIN journal_entries j ON j.invoice_id = i.id AND j.type = 'payment'
        AND j.posting_status IN ('posted','reversed')
      WHERE i.type = 'incoming'
      GROUP BY i.id, i.number, i.status
      HAVING COUNT(DISTINCT j.id) > COUNT(DISTINCT p.id)
         OR (COUNT(DISTINCT p.id) > 0 AND
             COUNT(DISTINCT j.id) FILTER (WHERE j.reference = i.number || '-PAY') > 0)
      ORDER BY i.id
    `,
  },
  {
    label: 'Payments without a clearly matching journal (candidates, not conclusions)',
    sql: `
      SELECT p.id AS payment_id, p.invoice_id, p.po_id, p.reference, p.amount,
             p.currency, p.amount_egp
      FROM payments p
      WHERE NOT EXISTS (
        SELECT 1 FROM journal_entries j
        WHERE j.type = 'payment'
          AND j.posting_status IN ('posted', 'reversed')
          AND (j.reference = COALESCE(p.reference, 'PAY-' || p.id::text))
          AND (j.invoice_id IS NOT DISTINCT FROM p.invoice_id)
      )
      ORDER BY p.id
    `,
  },
  {
    label: 'Ambiguous journal references (do not delete by reference)',
    sql: `
      SELECT reference, COUNT(*)::int AS journal_count,
             STRING_AGG(id::text, ',' ORDER BY id) AS journal_ids
      FROM journal_entries
      WHERE reference IS NOT NULL
      GROUP BY reference
      HAVING COUNT(*) > 1
      ORDER BY journal_count DESC, reference
    `,
  },
  {
    label: 'POs with multiple PO-PAY journal records (investigate legitimate instalments)',
    sql: `
      SELECT po_id, reference, COUNT(*)::int AS journal_count
      FROM journal_entries
      WHERE po_id IS NOT NULL AND type = 'payment'
      GROUP BY po_id, reference
      HAVING COUNT(*) > 1
      ORDER BY po_id
    `,
  },
  {
    label: 'Supplier invoice journals versus invoice amounts (EGP base not converted here)',
    sql: `
      SELECT i.id AS invoice_id, i.number, i.currency, i.total,
             COUNT(j.id)::int AS invoice_journal_count
      FROM invoices i
      LEFT JOIN journal_entries j ON j.invoice_id = i.id
        AND j.type = 'invoice' AND j.posting_status IN ('posted', 'reversed')
      WHERE i.type = 'incoming'
      GROUP BY i.id, i.number, i.currency, i.total
      ORDER BY i.id
    `,
  },
];

async function main() {
  const client = new Client({
    host, port, user, password, database,
    connectionTimeoutMillis: 5000,
    application_name: 'kora_supplier_accounting_read_only_audit',
  });
  await client.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows: [identity] } = await client.query(
      "SELECT current_database() AS db, current_setting('transaction_read_only') AS read_only",
    );
    if (identity.db !== 'kora_test' || identity.read_only !== 'on') {
      throw new Error('REFUSING: actual connection identity/read-only mode incorrect');
    }
    console.log('Verified local kora_test, read-only transaction. No writes performed.');
    for (const item of queries) {
      console.log('\n' + item.label);
      const { rows } = await client.query(item.sql);
      // Only report metadata, not full customer/supplier identifiers or detailed financial data.
      console.log('Candidate rows:', rows.length);
      console.table(rows.slice(0, 20));
      if (rows.length > 20) console.log(`Showing first 20 of ${rows.length} rows`);
    }
    await client.query('ROLLBACK');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error('Supplier audit failed:', error.message);
  process.exitCode = 1;
});
