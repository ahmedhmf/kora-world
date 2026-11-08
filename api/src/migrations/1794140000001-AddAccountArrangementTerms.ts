import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountArrangementTerms1794140000001 implements MigrationInterface {
  name = 'AddAccountArrangementTerms1794140000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "consignment_pricing_method" VARCHAR(20)`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "consignment_share_percent" NUMERIC(5,2)`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "settlement_due_day" INTEGER`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "upfront_percent" NUMERIC(5,2)`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "balance_due" VARCHAR(40)`);
    await queryRunner.query(`UPDATE "accounts" SET "payment_model" = 'Full Payment Upfront' WHERE "payment_model" = 'Direct Purchase'`);
    await queryRunner.query(`UPDATE "accounts" SET "payment_model" = 'Consignment' WHERE "payment_model" = 'Consignment (Monthly Settlement)'`);
    await queryRunner.query(`UPDATE "accounts" SET "consignment_pricing_method" = 'fixed', "settlement_due_day" = 5 WHERE "payment_model" = 'Consignment' AND "consignment_pricing_method" IS NULL`);
    await queryRunner.query(`INSERT INTO "dropdown_options" ("category", "value") VALUES ('accountPaymentModel', 'Full Payment Upfront'), ('accountPaymentModel', 'Split Payment'), ('accountPaymentModel', 'Consignment') ON CONFLICT ("category", "value") DO NOTHING`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-destructive: preserve account financial arrangements on rollback.
  }
}
