import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductPhotoFields1750000000009 implements MigrationInterface {
  name = 'AddProductPhotoFields1750000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN "image_path" VARCHAR(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN "image_name" VARCHAR(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "image_name"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "image_path"`);
  }
}
