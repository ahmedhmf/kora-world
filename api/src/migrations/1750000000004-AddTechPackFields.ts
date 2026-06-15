import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTechPackFields1750000000004 implements MigrationInterface {
  name = 'AddTechPackFields1750000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN "tech_pack_path" VARCHAR(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN "tech_pack_name" VARCHAR(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "prototypes" ADD COLUMN "tech_pack_path" VARCHAR(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "prototypes" ADD COLUMN "tech_pack_name" VARCHAR(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "prototypes" DROP COLUMN "tech_pack_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prototypes" DROP COLUMN "tech_pack_path"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "tech_pack_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "tech_pack_path"`,
    );
  }
}
