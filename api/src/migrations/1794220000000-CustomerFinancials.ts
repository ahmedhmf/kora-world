import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerFinancials1794220000000 implements MigrationInterface {
  name = 'CustomerFinancials1794220000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "customer_pricing_rules" (
      "id" SERIAL PRIMARY KEY, "account_id" int NOT NULL REFERENCES "accounts"("id") ON DELETE RESTRICT,
      "product_id" int NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
      "kind" varchar(30) NOT NULL CHECK ("kind" IN ('fixed','customer_fixed','commission_actual','commission_agreed')),
      "unitPrice" numeric(14,2), "commission_percent" numeric(5,2), "agreed_retail_price" numeric(14,2),
      "currency" varchar(3) NOT NULL, "effective_from" date NOT NULL, "effective_to" date,
      "created_by_id" int NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(),
      CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from"),
      CHECK ("commission_percent" IS NULL OR ("commission_percent" >= 0 AND "commission_percent" <= 100))
    )`);
    await q.query('CREATE INDEX "IDX_pricing_lookup" ON "customer_pricing_rules" ("account_id","product_id","effective_from")');
    await q.query(`CREATE TABLE "sales_settlements" (
      "id" SERIAL PRIMARY KEY, "report_id" int NOT NULL UNIQUE REFERENCES "weekly_sales_reports"("id") ON DELETE RESTRICT,
      "account_id" int NOT NULL REFERENCES "accounts"("id") ON DELETE RESTRICT,
      "currency" varchar(3) NOT NULL, "total_cents" bigint NOT NULL CHECK ("total_cents" >= 0),
      "lines" jsonb NOT NULL, "status" varchar(20) NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','reversed')),
      "reversed_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query('CREATE INDEX "IDX_settlement_account" ON "sales_settlements" ("account_id")');
    await q.query(`CREATE TABLE "customer_payments" (
      "id" SERIAL PRIMARY KEY, "account_id" int NOT NULL REFERENCES "accounts"("id") ON DELETE RESTRICT,
      "amount_cents" bigint NOT NULL CHECK ("amount_cents" > 0), "currency" varchar(3) NOT NULL,
      "payment_date" date NOT NULL, "reference" varchar(150) NOT NULL, "method" varchar(30) NOT NULL,
      "created_by_id" int NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query('CREATE INDEX "IDX_payment_account" ON "customer_payments" ("account_id")');
    await q.query(`CREATE TABLE "payment_allocations" (
      "id" SERIAL PRIMARY KEY, "payment_id" int NOT NULL REFERENCES "customer_payments"("id") ON DELETE RESTRICT,
      "settlement_id" int NOT NULL REFERENCES "sales_settlements"("id") ON DELETE RESTRICT,
      "amount_cents" bigint NOT NULL CHECK ("amount_cents" > 0), "created_by_id" int NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_payment_settlement" UNIQUE ("payment_id","settlement_id")
    )`);
    await q.query('ALTER TABLE "weekly_sales_reports" ADD COLUMN "retail_prices" jsonb');
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE "weekly_sales_reports" DROP COLUMN "retail_prices"');
    await q.query('DROP TABLE "payment_allocations"');
    await q.query('DROP TABLE "customer_payments"');
    await q.query('DROP TABLE "sales_settlements"');
    await q.query('DROP TABLE "customer_pricing_rules"');
  }
}
