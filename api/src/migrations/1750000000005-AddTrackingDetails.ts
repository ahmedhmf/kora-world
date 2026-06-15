import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrackingDetails1750000000005 implements MigrationInterface {
  name = 'AddTrackingDetails1750000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD COLUMN "carrier" VARCHAR(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD COLUMN "tracking_number" VARCHAR(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "prototypes" ADD COLUMN "carrier" VARCHAR(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "prototypes" ADD COLUMN "tracking_number" VARCHAR(100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "prototypes" DROP COLUMN "tracking_number"`,
    );
    await queryRunner.query(`ALTER TABLE "prototypes" DROP COLUMN "carrier"`);
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP COLUMN "tracking_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP COLUMN "carrier"`,
    );
  }
}
