import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductGraphicFields1750000000027 implements MigrationInterface {
  name = 'AddProductGraphicFields1750000000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "graphic_logo_path" VARCHAR(255)`);
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "graphic_logo_name" VARCHAR(255)`);
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "graphic_pattern_path" VARCHAR(255)`);
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "graphic_pattern_name" VARCHAR(255)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "graphic_pattern_name"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "graphic_pattern_path"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "graphic_logo_name"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "graphic_logo_path"`);
  }
}
