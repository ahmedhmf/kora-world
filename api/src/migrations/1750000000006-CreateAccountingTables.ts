import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAccountingTables1750000000006 implements MigrationInterface {
  name = 'CreateAccountingTables1750000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create accounting_accounts (Chart of Accounts)
    await queryRunner.query(`
      CREATE TABLE "accounting_accounts" (
        "id" SERIAL PRIMARY KEY,
        "code" VARCHAR(50) NOT NULL UNIQUE,
        "name" VARCHAR(150) NOT NULL,
        "type" VARCHAR(50) NOT NULL,
        "currency" VARCHAR(10) NOT NULL DEFAULT 'EUR',
        "parent_id" INTEGER,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        CONSTRAINT "fk_accounting_accounts_parent" FOREIGN KEY ("parent_id") REFERENCES "accounting_accounts"("id") ON DELETE SET NULL
      )
    `);

    // 2. Create invoices
    await queryRunner.query(`
      CREATE TABLE "invoices" (
        "id" SERIAL PRIMARY KEY,
        "number" VARCHAR(100) NOT NULL UNIQUE,
        "type" VARCHAR(50) NOT NULL,
        "supplier_id" INTEGER,
        "customer_name" VARCHAR(150),
        "date" DATE NOT NULL,
        "due_date" DATE NOT NULL,
        "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
        "currency" VARCHAR(10) NOT NULL,
        "subtotal" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        "tax" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        "total" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        "po_id" INTEGER,
        CONSTRAINT "fk_invoices_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_invoices_po" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL
      )
    `);

    // 3. Create invoice_lines
    await queryRunner.query(`
      CREATE TABLE "invoice_lines" (
        "id" SERIAL PRIMARY KEY,
        "invoice_id" INTEGER NOT NULL,
        "description" TEXT NOT NULL,
        "quantity" NUMERIC(12,4) NOT NULL,
        "unit_price" NUMERIC(12,2) NOT NULL,
        "total" NUMERIC(12,2) NOT NULL,
        CONSTRAINT "fk_invoice_lines_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE
      )
    `);

    // 4. Create journal_entries
    await queryRunner.query(`
      CREATE TABLE "journal_entries" (
        "id" SERIAL PRIMARY KEY,
        "date" DATE NOT NULL,
        "description" TEXT,
        "reference" VARCHAR(100),
        "type" VARCHAR(50) NOT NULL,
        "po_id" INTEGER,
        "invoice_id" INTEGER,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_journal_entries_po" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_journal_entries_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL
      )
    `);

    // 5. Create journal_lines
    await queryRunner.query(`
      CREATE TABLE "journal_lines" (
        "id" SERIAL PRIMARY KEY,
        "journal_entry_id" INTEGER NOT NULL,
        "account_id" INTEGER NOT NULL,
        "debit" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        "credit" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        "currency" VARCHAR(10) NOT NULL,
        "exchange_rate" NUMERIC(12,6) NOT NULL DEFAULT 1.000000,
        "amount_eur" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        CONSTRAINT "fk_journal_lines_entry" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_journal_lines_account" FOREIGN KEY ("account_id") REFERENCES "accounting_accounts"("id") ON DELETE RESTRICT
      )
    `);

    // 6. Create payments
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" SERIAL PRIMARY KEY,
        "invoice_id" INTEGER,
        "date" DATE NOT NULL,
        "amount" NUMERIC(12,2) NOT NULL,
        "currency" VARCHAR(10) NOT NULL,
        "exchange_rate" NUMERIC(12,6) NOT NULL DEFAULT 1.000000,
        "amount_eur" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        "method" VARCHAR(50) NOT NULL,
        "reference" VARCHAR(100),
        "notes" TEXT,
        CONSTRAINT "fk_payments_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL
      )
    `);

    // 7. Create exchange_rates
    await queryRunner.query(`
      CREATE TABLE "exchange_rates" (
        "id" SERIAL PRIMARY KEY,
        "from_currency" VARCHAR(10) NOT NULL,
        "to_currency" VARCHAR(10) NOT NULL,
        "rate" NUMERIC(12,6) NOT NULL,
        "date" DATE NOT NULL,
        CONSTRAINT "uq_exchange_rates" UNIQUE ("from_currency", "to_currency", "date")
      )
    `);

    // 8. Seed accounting_accounts data (Chart of Accounts)
    // Level 1 Parents
    await queryRunner.query(`
      INSERT INTO "accounting_accounts" ("code", "name", "type", "currency", "parent_id", "is_active") VALUES
      ('1000', 'Assets', 'asset', 'EUR', NULL, TRUE),
      ('1200', 'Accounts Receivable', 'asset', 'EUR', NULL, TRUE),
      ('1300', 'Inventory', 'asset', 'EUR', NULL, TRUE),
      ('2000', 'Liabilities', 'liability', 'EUR', NULL, TRUE),
      ('3000', 'Equity', 'equity', 'EUR', NULL, TRUE),
      ('4000', 'Revenue', 'revenue', 'EUR', NULL, TRUE),
      ('5000', 'Expenses', 'expense', 'EUR', NULL, TRUE);
    `);

    // Level 2 (1100 Cash & Bank)
    await queryRunner.query(`
      INSERT INTO "accounting_accounts" ("code", "name", "type", "currency", "parent_id", "is_active")
      SELECT '1100', 'Cash & Bank', 'asset', 'EUR', id, TRUE FROM "accounting_accounts" WHERE "code" = '1000';
    `);

    // Level 3 Banks
    await queryRunner.query(`
      INSERT INTO "accounting_accounts" ("code", "name", "type", "currency", "parent_id", "is_active")
      SELECT '1101', 'EUR Bank', 'asset', 'EUR', id, TRUE FROM "accounting_accounts" WHERE "code" = '1100';
      
      INSERT INTO "accounting_accounts" ("code", "name", "type", "currency", "parent_id", "is_active")
      SELECT '1102', 'EGP Bank', 'asset', 'EGP', id, TRUE FROM "accounting_accounts" WHERE "code" = '1100';

      INSERT INTO "accounting_accounts" ("code", "name", "type", "currency", "parent_id", "is_active")
      SELECT '1103', 'USD Bank', 'asset', 'USD', id, TRUE FROM "accounting_accounts" WHERE "code" = '1100';
    `);

    // Level 2 Liabilities
    await queryRunner.query(`
      INSERT INTO "accounting_accounts" ("code", "name", "type", "currency", "parent_id", "is_active") VALUES
      ('2100', 'Accounts Payable', 'liability', 'EUR', (SELECT id FROM "accounting_accounts" WHERE "code" = '2000'), TRUE),
      ('2200', 'VAT Payable', 'liability', 'EUR', (SELECT id FROM "accounting_accounts" WHERE "code" = '2000'), TRUE);
    `);

    // Level 2 Equity
    await queryRunner.query(`
      INSERT INTO "accounting_accounts" ("code", "name", "type", "currency", "parent_id", "is_active") VALUES
      ('3100', 'Owner Capital', 'equity', 'EUR', (SELECT id FROM "accounting_accounts" WHERE "code" = '3000'), TRUE),
      ('3200', 'Retained Earnings', 'equity', 'EUR', (SELECT id FROM "accounting_accounts" WHERE "code" = '3000'), TRUE);
    `);

    // Level 2 Revenue
    await queryRunner.query(`
      INSERT INTO "accounting_accounts" ("code", "name", "type", "currency", "parent_id", "is_active") VALUES
      ('4100', 'Product Sales', 'revenue', 'EUR', (SELECT id FROM "accounting_accounts" WHERE "code" = '4000'), TRUE),
      ('4200', 'Other Income', 'revenue', 'EUR', (SELECT id FROM "accounting_accounts" WHERE "code" = '4000'), TRUE);
    `);

    // Level 2 Expenses
    await queryRunner.query(`
      INSERT INTO "accounting_accounts" ("code", "name", "type", "currency", "parent_id", "is_active") VALUES
      ('5100', 'COGS', 'expense', 'EUR', (SELECT id FROM "accounting_accounts" WHERE "code" = '5000'), TRUE),
      ('5200', 'Shipping', 'expense', 'EUR', (SELECT id FROM "accounting_accounts" WHERE "code" = '5000'), TRUE),
      ('5300', 'Marketing', 'expense', 'EUR', (SELECT id FROM "accounting_accounts" WHERE "code" = '5000'), TRUE),
      ('5400', 'Software', 'expense', 'EUR', (SELECT id FROM "accounting_accounts" WHERE "code" = '5000'), TRUE),
      ('5500', 'Salaries', 'expense', 'EUR', (SELECT id FROM "accounting_accounts" WHERE "code" = '5000'), TRUE),
      ('5600', 'Other', 'expense', 'EUR', (SELECT id FROM "accounting_accounts" WHERE "code" = '5000'), TRUE);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "exchange_rates"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TABLE "journal_lines"`);
    await queryRunner.query(`DROP TABLE "journal_entries"`);
    await queryRunner.query(`DROP TABLE "invoice_lines"`);
    await queryRunner.query(`DROP TABLE "invoices"`);
    await queryRunner.query(`DROP TABLE "accounting_accounts"`);
  }
}
