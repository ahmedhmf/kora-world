import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductPricepoint1750000000011 implements MigrationInterface {
  name = 'AddProductPricepoint1750000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN "pricepoint" VARCHAR(50)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "pricepoint"`);
  }
}
