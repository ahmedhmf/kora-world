import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenamePrototypesToSamples1750000000006 implements MigrationInterface {
  name = 'RenamePrototypesToSamples1750000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "prototypes" RENAME TO "samples"`);
    await queryRunner.query(
      `ALTER TABLE "samples" RENAME CONSTRAINT "prototypes_pkey" TO "samples_pkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "samples" RENAME CONSTRAINT "prototypes_supplier_id_fkey" TO "samples_supplier_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER SEQUENCE "prototypes_id_seq" RENAME TO "samples_id_seq"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER SEQUENCE "samples_id_seq" RENAME TO "prototypes_id_seq"`,
    );
    await queryRunner.query(
      `ALTER TABLE "samples" RENAME CONSTRAINT "samples_supplier_id_fkey" TO "prototypes_supplier_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "samples" RENAME CONSTRAINT "samples_pkey" TO "prototypes_pkey"`,
    );
    await queryRunner.query(`ALTER TABLE "samples" RENAME TO "prototypes"`);
  }
}
