import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupplierToUser1750000000022 implements MigrationInterface {
  name = 'AddSupplierToUser1750000000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "supplier_id" INTEGER`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_users_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_users_supplier"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "supplier_id"`);
  }
}
