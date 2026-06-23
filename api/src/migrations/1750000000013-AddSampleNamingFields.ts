import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSampleNamingFields1750000000013 implements MigrationInterface {
  name = 'AddSampleNamingFields1750000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "samples" ADD COLUMN "article_number" VARCHAR(50)`,
    );
    await queryRunner.query(`ALTER TABLE "samples" ADD COLUMN "year" INTEGER`);
    await queryRunner.query(
      `ALTER TABLE "samples" ADD COLUMN "article_counter" INTEGER`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "samples" DROP COLUMN "article_counter"`,
    );
    await queryRunner.query(`ALTER TABLE "samples" DROP COLUMN "year"`);
    await queryRunner.query(
      `ALTER TABLE "samples" DROP COLUMN "article_number"`,
    );
  }
}
