import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSampleRounds1750000000007 implements MigrationInterface {
  name = 'AddSampleRounds1750000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "samples" ADD COLUMN "parent_sample_id" INTEGER`,
    );
    await queryRunner.query(
      `ALTER TABLE "samples" ADD COLUMN "round_number" INTEGER NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "samples" ADD CONSTRAINT "FK_samples_parent_sample" FOREIGN KEY ("parent_sample_id") REFERENCES "samples"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "samples" DROP CONSTRAINT "FK_samples_parent_sample"`,
    );
    await queryRunner.query(
      `ALTER TABLE "samples" DROP COLUMN "round_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "samples" DROP COLUMN "parent_sample_id"`,
    );
  }
}
