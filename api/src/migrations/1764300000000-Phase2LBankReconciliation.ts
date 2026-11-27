import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2L is intentionally a disposable local pilot.
 * Production databases receive no new tables from this migration.
 * Production rollout requires a separately reviewed migration.
 */
export class Phase2LBankReconciliation1764300000000 implements MigrationInterface {
  name = 'Phase2LBankReconciliation1764300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [db] = await queryRunner.query('SELECT current_database() AS name');
    if (db?.name !== 'kora_test') return;

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS accounting_bank_statement_imports (
        id SERIAL PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounting_accounts(id) ON DELETE RESTRICT,
        statement_key VARCHAR(120) NOT NULL,
        currency VARCHAR(10) NOT NULL CHECK (currency = 'EGP'),
        opening_balance_cents BIGINT,
        closing_balance_cents BIGINT,
        imported_by_id INTEGER NOT NULL,
        imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (account_id, statement_key)
      )`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS accounting_bank_statement_rows (
        id SERIAL PRIMARY KEY,
        import_id INTEGER NOT NULL REFERENCES accounting_bank_statement_imports(id) ON DELETE RESTRICT,
        account_id INTEGER NOT NULL REFERENCES accounting_accounts(id) ON DELETE RESTRICT,
        row_number INTEGER NOT NULL CHECK (row_number > 0),
        txn_date DATE NOT NULL,
        reference VARCHAR(150) NOT NULL DEFAULT '',
        description VARCHAR(500) NOT NULL DEFAULT '',
        amount_cents BIGINT NOT NULL CHECK (amount_cents <> 0),
        fingerprint VARCHAR(64) NOT NULL,
        matched_journal_line_id INTEGER REFERENCES journal_lines(id) ON DELETE RESTRICT,
        matched_by_id INTEGER,
        matched_at TIMESTAMPTZ,
        match_reason VARCHAR(500),
        UNIQUE (import_id, row_number),
        UNIQUE (account_id, fingerprint)
      )`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_row_unique_matched_line
      ON accounting_bank_statement_rows(matched_journal_line_id)
      WHERE matched_journal_line_id IS NOT NULL`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS accounting_bank_reconciliation_events (
        id BIGSERIAL PRIMARY KEY,
        row_id INTEGER REFERENCES accounting_bank_statement_rows(id) ON DELETE RESTRICT,
        import_id INTEGER REFERENCES accounting_bank_statement_imports(id) ON DELETE RESTRICT,
        action VARCHAR(40) NOT NULL,
        actor_id INTEGER NOT NULL,
        journal_line_id INTEGER,
        detail TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [db] = await queryRunner.query('SELECT current_database() AS name');
    if (db?.name !== 'kora_test') return;
    await queryRunner.query('DROP TABLE IF EXISTS accounting_bank_reconciliation_events');
    await queryRunner.query('DROP TABLE IF EXISTS accounting_bank_statement_rows');
    await queryRunner.query('DROP TABLE IF EXISTS accounting_bank_statement_imports');
  }
}
