import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupplierContacts1750000000008 implements MigrationInterface {
  name = 'AddSupplierContacts1750000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create supplier_contacts table
    await queryRunner.query(`
      CREATE TABLE "supplier_contacts" (
        "id" SERIAL PRIMARY KEY,
        "supplier_id" INTEGER NOT NULL,
        "name" VARCHAR(100) NOT NULL,
        "email" VARCHAR(150) NOT NULL,
        "phone" VARCHAR(50),
        "role" VARCHAR(100),
        "send_info" BOOLEAN NOT NULL DEFAULT FALSE,
        "send_po" BOOLEAN NOT NULL DEFAULT FALSE,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "FK_supplier_contacts_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE
      )
    `);

    // 2. Migrate existing contacts
    await queryRunner.query(`
      INSERT INTO "supplier_contacts" ("supplier_id", "name", "email", "phone", "send_info", "send_po")
      SELECT "id", "contact_name", COALESCE("contact_email", 'change-me@kora.com'), COALESCE("contact_phone", ''), TRUE, TRUE
      FROM "suppliers"
      WHERE "contact_name" IS NOT NULL AND "contact_name" <> '';
    `);

    // 3. Drop old columns from suppliers
    await queryRunner.query(`ALTER TABLE "suppliers" DROP COLUMN "contact_name"`);
    await queryRunner.query(`ALTER TABLE "suppliers" DROP COLUMN "contact_email"`);
    await queryRunner.query(`ALTER TABLE "suppliers" DROP COLUMN "contact_phone"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Add back columns to suppliers table
    await queryRunner.query(`ALTER TABLE "suppliers" ADD COLUMN "contact_name" VARCHAR(100)`);
    await queryRunner.query(`ALTER TABLE "suppliers" ADD COLUMN "contact_email" VARCHAR(150)`);
    await queryRunner.query(`ALTER TABLE "suppliers" ADD COLUMN "contact_phone" VARCHAR(50)`);

    // 2. Restore data from supplier_contacts to suppliers
    await queryRunner.query(`
      UPDATE "suppliers" s
      SET
        "contact_name" = c."name",
        "contact_email" = c."email",
        "contact_phone" = c."phone"
      FROM (
        SELECT DISTINCT ON ("supplier_id") "supplier_id", "name", "email", "phone"
        FROM "supplier_contacts"
        ORDER BY "supplier_id", "send_info" DESC, "send_po" DESC, "id" ASC
      ) c
      WHERE s."id" = c."supplier_id"
    `);

    // 3. Drop supplier_contacts table
    await queryRunner.query(`DROP TABLE "supplier_contacts"`);
  }
}
