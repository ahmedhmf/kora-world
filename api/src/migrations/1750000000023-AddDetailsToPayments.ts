import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDetailsToPayments1750000000023 implements MigrationInterface {
  name = 'AddDetailsToPayments1750000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments" ADD COLUMN "description" VARCHAR(255) DEFAULT '';
      ALTER TABLE "payments" ADD COLUMN "paid_from_account_id" INTEGER;
      ALTER TABLE "payments" ADD COLUMN "category_account_id" INTEGER;
      ALTER TABLE "payments" ADD COLUMN "po_id" INTEGER;
      ALTER TABLE "payments" ADD COLUMN "attachment" VARCHAR(500);

      ALTER TABLE "payments" ADD CONSTRAINT "fk_payments_paid_from_account" FOREIGN KEY ("paid_from_account_id") REFERENCES "accounting_accounts"("id") ON DELETE RESTRICT;
      ALTER TABLE "payments" ADD CONSTRAINT "fk_payments_category_account" FOREIGN KEY ("category_account_id") REFERENCES "accounting_accounts"("id") ON DELETE RESTRICT;
      ALTER TABLE "payments" ADD CONSTRAINT "fk_payments_po" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments" DROP CONSTRAINT "fk_payments_po";
      ALTER TABLE "payments" DROP CONSTRAINT "fk_payments_category_account";
      ALTER TABLE "payments" DROP CONSTRAINT "fk_payments_paid_from_account";

      ALTER TABLE "payments" DROP COLUMN "attachment";
      ALTER TABLE "payments" DROP COLUMN "po_id";
      ALTER TABLE "payments" DROP COLUMN "category_account_id";
      ALTER TABLE "payments" DROP COLUMN "paid_from_account_id";
      ALTER TABLE "payments" DROP COLUMN "description";
    `);
  }
}
