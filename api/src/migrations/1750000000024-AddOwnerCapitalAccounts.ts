import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOwnerCapitalAccounts1750000000024 implements MigrationInterface {
  name = 'AddOwnerCapitalAccounts1750000000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "accounting_accounts" ("code", "name", "type", "currency", "parent_id", "is_active")
      SELECT '3101', 'Ahmed Capital', 'equity', 'EUR', id, TRUE
      FROM "accounting_accounts" WHERE "code" = '3100'
      ON CONFLICT ("code") DO NOTHING;

      INSERT INTO "accounting_accounts" ("code", "name", "type", "currency", "parent_id", "is_active")
      SELECT '3102', 'Mostafa Capital', 'equity', 'EUR', id, TRUE
      FROM "accounting_accounts" WHERE "code" = '3100'
      ON CONFLICT ("code") DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "accounting_accounts" WHERE "code" IN ('3101', '3102');
    `);
  }
}
