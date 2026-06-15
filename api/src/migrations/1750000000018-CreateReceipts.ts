import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReceipts1750000000018 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create receipts table
    await queryRunner.query(`
      CREATE TABLE receipts (
        id SERIAL PRIMARY KEY,
        receipt_number VARCHAR(50) NOT NULL UNIQUE,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        issue_date DATE NOT NULL,
        due_date DATE,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        payment_terms VARCHAR(100),
        vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
        subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
        discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Create receipt line items table
    await queryRunner.query(`
      CREATE TABLE receipt_line_items (
        id SERIAL PRIMARY KEY,
        receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        article_number VARCHAR(100) NOT NULL,
        description VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
        discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
        line_total NUMERIC(14, 2) NOT NULL DEFAULT 0
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS receipt_line_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS receipts`);
  }
}
