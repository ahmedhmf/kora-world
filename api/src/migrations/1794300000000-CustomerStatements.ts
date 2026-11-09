import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerStatements1794300000000 implements MigrationInterface {
  name = 'CustomerStatements1794300000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "customer_statements" (
      "id" SERIAL PRIMARY KEY,
      "account_id" int NOT NULL REFERENCES "accounts"("id") ON DELETE RESTRICT,
      "currency" varchar(3) NOT NULL,
      "period_from" date NOT NULL,
      "period_to" date NOT NULL,
      "snapshot" jsonb NOT NULL,
      "created_by_id" int NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "CHK_statement_dates" CHECK ("period_to" >= "period_from")
    )`);
    await q.query('CREATE INDEX "IDX_statement_history" ON "customer_statements" ("account_id", "created_at")');
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE "customer_statements"');
  }
}
