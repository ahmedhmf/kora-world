import { MigrationInterface, QueryRunner } from 'typeorm';

export class FounderAccounts1795770003000 implements MigrationInterface {
 name='FounderAccounts1795770003000';
 async up(q:QueryRunner):Promise<void>{
  const [db]=await q.query('SELECT current_database() AS name');
  if(db?.name!=='kora_test')throw new Error('Founder accounts pilot requires kora_test');
  await q.query(`CREATE TABLE founder_accounts (
    account_id INTEGER PRIMARY KEY REFERENCES accounting_accounts(id) ON DELETE RESTRICT,
    founder_name VARCHAR(120) NOT NULL, created_by INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await q.query('CREATE UNIQUE INDEX founder_accounts_name_unique ON founder_accounts(lower(founder_name))');
  await q.query(`CREATE TABLE founder_transactions (
    id SERIAL PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES founder_accounts(account_id),
    journal_id INTEGER NOT NULL UNIQUE REFERENCES journal_entries(id) ON DELETE RESTRICT,
    kind VARCHAR(20) NOT NULL CHECK(kind IN ('expense','loan','repayment')),
    evidence_reference VARCHAR(300) NOT NULL, request_key VARCHAR(100) NOT NULL UNIQUE,
    created_by INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
 }
 async down():Promise<void>{throw new Error('Founder accounting data requires reviewed backup restore');}
}
