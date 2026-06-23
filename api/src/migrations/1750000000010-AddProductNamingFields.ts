import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductNamingFields1750000000010 implements MigrationInterface {
  name = 'AddProductNamingFields1750000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN "collection" VARCHAR(10)`,
    );
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN "year" INTEGER`);
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN "article_counter" INTEGER`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "article_counter"`,
    );
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "year"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "collection"`);
  }
}
