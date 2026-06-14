import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShippingCosts1750000000002 implements MigrationInterface {
  name = 'AddShippingCosts1750000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "suppliers" ADD COLUMN "shipping_rate_per_kg" numeric(10,2) NOT NULL DEFAULT 0.00
    `);
    await queryRunner.query(`
      ALTER TABLE "purchase_orders" ADD COLUMN "shipping_cost" numeric(12,2) NOT NULL DEFAULT 0.00
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "purchase_orders" DROP COLUMN "shipping_cost"
    `);
    await queryRunner.query(`
      ALTER TABLE "suppliers" DROP COLUMN "shipping_rate_per_kg"
    `);
  }
}
