import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1750000000003 implements MigrationInterface {
  name = 'CreateUsers1750000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" SERIAL PRIMARY KEY,
        "email" VARCHAR(150) UNIQUE NOT NULL,
        "password" VARCHAR(255) NOT NULL,
        "name" VARCHAR(150) NOT NULL,
        "role" VARCHAR(50) NOT NULL DEFAULT 'employee',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 2. Seed initial users
    const adminHash = '0f086f5cc90ddec5b51eabc1e7aac29f:420cf67e5ad2cad6da6ce02d0c0abd3c7719ed3c2797066a3158f3f8ad84aa6fa9a1cd9b59866d205d84821f8ecffc650eb62b9b15f03961bc8e4c1166e428ad';
    const staffHash = 'd74e01dc82e320a1905c63ae96db47ba:b053b97dea0af780491c9e07e5c4b3f4e0e9ff51285e03c4823bb17ee913255d9534bb3fad6e394f9014bf417c2f05ecc7562f2b4716724656195b984032fda2';

    await queryRunner.query(`
      INSERT INTO "users" ("email", "password", "name", "role") VALUES
      ('admin@kora.com', '${adminHash}', 'Admin User', 'admin'),
      ('staff@kora.com', '${staffHash}', 'Operations Staff', 'employee')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
