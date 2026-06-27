import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductSize1750000000028 implements MigrationInterface {
  name = 'AddProductSize1750000000028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "size" VARCHAR(20)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "size"`);
  }
}
