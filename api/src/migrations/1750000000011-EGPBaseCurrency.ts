import { MigrationInterface, QueryRunner } from 'typeorm';

export class EGPBaseCurrency1750000000011 implements MigrationInterface {
  name = 'EGPBaseCurrency1750000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Update journal_lines table
    await queryRunner.query(`
      ALTER TABLE "journal_lines" ADD COLUMN IF NOT EXISTS "amount_egp" NUMERIC(12,2);
      ALTER TABLE "journal_lines" RENAME COLUMN "amount_eur" TO "amount_base";
    `);

    // 2. Update payments table
    await queryRunner.query(`
      ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "amount_egp" NUMERIC(12,2);
      ALTER TABLE "payments" RENAME COLUMN "amount_eur" TO "amount_base";
    `);

    // 3. Update exchange_rates table
    await queryRunner.query(`
      ALTER TABLE "exchange_rates" ADD COLUMN IF NOT EXISTS "notes" VARCHAR(255);
    `);

    // 4. Add exchange rate accounts to chart of accounts
    await queryRunner.query(`
      INSERT INTO "accounting_accounts" ("code", "name", "type", "currency", "parent_id", "is_active")
      SELECT '4201', 'Exchange Rate Gain', 'revenue', 'EGP', id, TRUE 
      FROM "accounting_accounts" WHERE "code" = '4200'
      ON CONFLICT ("code") DO NOTHING;

      INSERT INTO "accounting_accounts" ("code", "name", "type", "currency", "parent_id", "is_active")
      SELECT '5601', 'Exchange Rate Loss', 'expense', 'EGP', id, TRUE 
      FROM "accounting_accounts" WHERE "code" = '5600'
      ON CONFLICT ("code") DO NOTHING;
    `);

    // 5. Update existing accounts
    await queryRunner.query(`
      UPDATE "accounting_accounts" SET "currency" = 'EGP' WHERE "currency" = 'EUR';
      UPDATE "accounting_accounts" SET "currency" = 'EGP' WHERE "code" IN ('1101', '1102', '1103', '1200', '1300', '2100', '2200', '3100', '3101', '3102', '3200', '4100', '4200', '5100', '5200', '5300', '5400', '5500', '5600');
    `);

    // 6. Rename 1101 EUR Bank to EGP Bank Main
    await queryRunner.query(`
      UPDATE "accounting_accounts" SET "name" = 'EGP Bank Account (Main)' WHERE "code" = '1101';
    `);

    // 7. Add USD and EUR bank accounts
    await queryRunner.query(`
      INSERT INTO "accounting_accounts" ("code", "name", "type", "currency", "parent_id", "is_active")
      SELECT '1104', 'USD Bank Account', 'asset', 'USD', id, TRUE 
      FROM "accounting_accounts" WHERE "code" = '1100'
      ON CONFLICT ("code") DO NOTHING;

      INSERT INTO "accounting_accounts" ("code", "name", "type", "currency", "parent_id", "is_active")
      SELECT '1105', 'EUR Bank Account', 'asset', 'EUR', id, TRUE 
      FROM "accounting_accounts" WHERE "code" = '1100'
      ON CONFLICT ("code") DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert account creations and modifications
    await queryRunner.query(`
      DELETE FROM "accounting_accounts" WHERE "code" IN ('1104', '1105', '4201', '5601');
      UPDATE "accounting_accounts" SET "name" = 'EUR Bank' WHERE "code" = '1101';
      UPDATE "accounting_accounts" SET "currency" = 'EUR' WHERE "code" IN ('1101', '1102', '1103', '1200', '1300', '2100', '2200', '3100', '3101', '3102', '3200', '4100', '4200', '5100', '5200', '5300', '5400', '5500', '5600');
    `);

    // Revert table schema changes
    await queryRunner.query(`
      ALTER TABLE "exchange_rates" DROP COLUMN IF EXISTS "notes";
    `);

    await queryRunner.query(`
      ALTER TABLE "payments" RENAME COLUMN "amount_base" TO "amount_eur";
      ALTER TABLE "payments" DROP COLUMN IF EXISTS "amount_egp";
    `);

    await queryRunner.query(`
      ALTER TABLE "journal_lines" RENAME COLUMN "amount_base" TO "amount_eur";
      ALTER TABLE "journal_lines" DROP COLUMN IF EXISTS "amount_egp";
    `);
  }
}
