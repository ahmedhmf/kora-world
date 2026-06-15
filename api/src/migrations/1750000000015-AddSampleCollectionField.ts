import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSampleCollectionField1750000000015 implements MigrationInterface {
  name = 'AddSampleCollectionField1750000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "samples" ADD COLUMN "collection" VARCHAR(10)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "samples" DROP COLUMN "collection"`);
  }
}
