import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePrototypes1750000000001 implements MigrationInterface {
  name = 'CreatePrototypes1750000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "prototypes" (
        "id" SERIAL PRIMARY KEY,
        "supplier_id" INTEGER NOT NULL REFERENCES "suppliers"("id") ON DELETE CASCADE,
        "name" VARCHAR(150) NOT NULL,
        "category" VARCHAR(50),
        "status" VARCHAR(50) NOT NULL DEFAULT 'requested',
        "construction" jsonb,
        "comments" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "prototypes"`);
  }
}
