import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddForecastsToAccounts1750000000025 implements MigrationInterface {
  name = 'AddForecastsToAccounts1750000000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "accounts" ADD "forecasts" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "accounts" DROP COLUMN "forecasts"
    `);
  }
}
