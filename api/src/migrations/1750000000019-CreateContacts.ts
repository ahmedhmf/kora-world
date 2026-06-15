import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContacts1750000000019 implements MigrationInterface {
  name = 'CreateContacts1750000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create contacts table
    await queryRunner.query(`
      CREATE TABLE "contacts" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(150) NOT NULL,
        "company" VARCHAR(150),
        "position" VARCHAR(100),
        "type" VARCHAR(50) NOT NULL,
        "supplier_id" INTEGER REFERENCES "suppliers"("id") ON DELETE SET NULL,
        "account_id" INTEGER REFERENCES "accounts"("id") ON DELETE SET NULL,
        "phones" JSONB,
        "email" VARCHAR(150),
        "whatsapp" VARCHAR(50),
        "facebook" VARCHAR(255),
        "instagram" VARCHAR(255),
        "address" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 2. Migrate existing contacts from supplier_contacts table
    await queryRunner.query(`
      INSERT INTO "contacts" ("name", "position", "type", "supplier_id", "email", "phones")
      SELECT 
        "name", 
        "role" AS "position", 
        'supplier' AS "type", 
        "supplier_id", 
        "email", 
        CASE 
          WHEN "phone" IS NOT NULL AND "phone" <> '' THEN json_build_array(json_build_object('number', "phone", 'label', 'Work'))::jsonb
          ELSE '[]'::jsonb
        END AS "phones"
      FROM "supplier_contacts"
    `);

    // 3. Migrate existing contact info from accounts table (primary contact name/email/phone)
    await queryRunner.query(`
      INSERT INTO "contacts" ("name", "type", "account_id", "email", "phones")
      SELECT 
        "primary_contact_name" AS "name",
        'account' AS "type",
        "id" AS "account_id",
        "primary_contact_email" AS "email",
        CASE 
          WHEN "primary_contact_phone" IS NOT NULL AND "primary_contact_phone" <> '' THEN json_build_array(json_build_object('number', "primary_contact_phone", 'label', 'Work'))::jsonb
          ELSE '[]'::jsonb
        END AS "phones"
      FROM "accounts"
      WHERE "primary_contact_name" IS NOT NULL AND "primary_contact_name" <> ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "contacts"`);
  }
}
