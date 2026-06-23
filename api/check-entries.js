const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const client = new Client({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  user: process.env.DATABASE_USER || process.env.DB_USER || 'kora_admin',
  password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'Ahmedhmf35',
  database: process.env.DATABASE_NAME || process.env.DB_NAME || 'kora_world',
});

async function main() {
  await client.connect();
  console.log('Connected to DB');

  const invoicesRes = await client.query('SELECT id, number, status, total FROM invoices ORDER BY id DESC LIMIT 5');
  console.log('--- LATEST 5 INVOICES ---');
  console.table(invoicesRes.rows);

  const entriesRes = await client.query('SELECT id, date, description, reference, type, invoice_id FROM journal_entries ORDER BY id DESC LIMIT 10');
  console.log('--- LATEST 10 JOURNAL ENTRIES ---');
  console.table(entriesRes.rows);

  const linesRes = await client.query('SELECT id, journal_entry_id, account_id, debit, credit FROM journal_lines ORDER BY id DESC LIMIT 10');
  console.log('--- LATEST 10 JOURNAL LINES ---');
  console.table(linesRes.rows);

  await client.end();
}

main().catch(console.error);
