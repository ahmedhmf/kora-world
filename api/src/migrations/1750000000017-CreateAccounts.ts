import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAccounts1750000000017 implements MigrationInterface {
  name = 'CreateAccounts1750000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "accounts" (
        "id" SERIAL PRIMARY KEY,
        "company_name" VARCHAR(150) NOT NULL,
        "account_number" VARCHAR(50) NOT NULL UNIQUE,
        "status" VARCHAR(50) NOT NULL DEFAULT 'under_discussion',
        "customer_type" VARCHAR(50) NOT NULL,
        "website" VARCHAR(255),
        "primary_contact_name" VARCHAR(150) NOT NULL,
        "primary_contact_email" VARCHAR(150) NOT NULL,
        "primary_contact_phone" VARCHAR(100),
        "billing_street" VARCHAR(255),
        "billing_city" VARCHAR(150),
        "billing_zip" VARCHAR(50),
        "billing_country" VARCHAR(150),
        "shipping_street" VARCHAR(255),
        "shipping_city" VARCHAR(150),
        "shipping_zip" VARCHAR(50),
        "shipping_country" VARCHAR(150),
        "default_currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
        "payment_terms" VARCHAR(50) NOT NULL DEFAULT 'Cash in Advance',
        "credit_limit" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        "vat_number" VARCHAR(100),
        "assigned_sales_rep_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
        "remarks" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "accounts"`);
  }
}
