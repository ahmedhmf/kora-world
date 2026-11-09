import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWeeklySalesReports1794200000000 implements MigrationInterface {
  name = 'CreateWeeklySalesReports1794200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "weekly_sales_reports" (
        "id" SERIAL PRIMARY KEY,
        "account_id" integer NOT NULL,
        "week_start" date NOT NULL,
        "week_end" date NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'draft',
        "items" jsonb NOT NULL,
        "file_path" varchar(255) NOT NULL,
        "file_name" varchar(255) NOT NULL,
        "remarks" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "approved_at" timestamptz,
        CONSTRAINT "FK_weekly_sales_account" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_weekly_sales_status" CHECK ("status" IN ('draft', 'approved')),
        CONSTRAINT "CHK_weekly_sales_week" CHECK ("week_end" >= "week_start")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_weekly_sales_account" ON "weekly_sales_reports" ("account_id")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "weekly_sales_reports"');
  }
}
