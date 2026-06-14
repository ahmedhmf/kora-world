import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductConstruction1750000000000 implements MigrationInterface {
  name = 'AddProductConstruction1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products" ADD COLUMN "construction" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products" DROP COLUMN "construction"
    `);
  }
}
