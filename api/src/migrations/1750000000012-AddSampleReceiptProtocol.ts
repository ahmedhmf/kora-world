import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSampleReceiptProtocol1750000000012 implements MigrationInterface {
  name = 'AddSampleReceiptProtocol1750000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "samples" ADD COLUMN "receipt_protocol" JSONB`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "samples" DROP COLUMN "receipt_protocol"`);
  }
}
