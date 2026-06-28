import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductImages1750000000029 implements MigrationInterface {
  name = 'AddProductImages1750000000029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "images" JSONB`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "images"`);
  }
}
