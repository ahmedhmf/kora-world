import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductCatalogPrices1750000000021 implements MigrationInterface {
  name = 'AddProductCatalogPrices1750000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN "landing_price" NUMERIC(10, 2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN "one_pc_price" NUMERIC(10, 2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN "bulk_price" NUMERIC(10, 2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "landing_price"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "one_pc_price"`,
    );
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "bulk_price"`);
  }
}
