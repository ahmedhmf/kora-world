import { MigrationInterface, QueryRunner } from 'typeorm';

export class InventoryCorrections1794210000000 implements MigrationInterface {
  name = 'InventoryCorrections1794210000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "weekly_sales_reports" ADD COLUMN "approved_by_id" integer, ADD COLUMN "approved_by_name" varchar(255), ADD COLUMN "cancelled_at" timestamptz, ADD COLUMN "cancelled_by_id" integer, ADD COLUMN "cancelled_by_name" varchar(255), ADD COLUMN "cancellation_reason" text`);
    await q.query(`ALTER TABLE "weekly_sales_reports" DROP CONSTRAINT "CHK_weekly_sales_status"`);
    await q.query(`ALTER TABLE "weekly_sales_reports" ADD CONSTRAINT "CHK_weekly_sales_status" CHECK ("status" IN ('draft', 'approved', 'cancelled'))`);
    await q.query(`CREATE TABLE "inventory_adjustments" (
      "id" SERIAL PRIMARY KEY,
      "account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE RESTRICT,
      "product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
      "article_number" varchar(255) NOT NULL,
      "product_name" varchar(255) NOT NULL,
      "quantity" integer NOT NULL CHECK ("quantity" <> 0),
      "reason" varchar(30) NOT NULL,
      "notes" text NOT NULL,
      "created_by_id" integer NOT NULL,
      "created_by_name" varchar(255) NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query('CREATE INDEX "IDX_inventory_adjustments_account" ON "inventory_adjustments" ("account_id")');
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE "inventory_adjustments"');
    await q.query(`ALTER TABLE "weekly_sales_reports" DROP CONSTRAINT "CHK_weekly_sales_status"`);
    await q.query(`ALTER TABLE "weekly_sales_reports" ADD CONSTRAINT "CHK_weekly_sales_status" CHECK ("status" IN ('draft', 'approved'))`);
    await q.query(`ALTER TABLE "weekly_sales_reports" DROP COLUMN "approved_by_id", DROP COLUMN "approved_by_name", DROP COLUMN "cancelled_at", DROP COLUMN "cancelled_by_id", DROP COLUMN "cancelled_by_name", DROP COLUMN "cancellation_reason"`);
  }
}
