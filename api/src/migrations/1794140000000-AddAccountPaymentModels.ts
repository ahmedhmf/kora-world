import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountPaymentModels1794140000000 implements MigrationInterface {
  name = 'AddAccountPaymentModels1794140000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "payment_model" VARCHAR(150)`);
    await queryRunner.query(`
      INSERT INTO "dropdown_options" ("category", "value")
      VALUES ('accountPaymentModel', 'Direct Purchase'),
             ('accountPaymentModel', 'Consignment (Monthly Settlement)')
      ON CONFLICT ("category", "value") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Intentionally retain account values and dropdown options to avoid data loss.
    // A destructive rollback requires a separately reviewed migration.
  }
}
