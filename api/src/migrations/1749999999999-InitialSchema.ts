import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1749999999999 implements MigrationInterface {
  name = 'InitialSchema1749999999999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Suppliers
    await queryRunner.query(`
      CREATE TABLE "suppliers" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(100) NOT NULL,
        "country" VARCHAR(100),
        "contact_name" VARCHAR(100),
        "contact_email" VARCHAR(150),
        "contact_phone" VARCHAR(50),
        "payment_terms" VARCHAR(100),
        "lead_time_days" INTEGER,
        "currency" VARCHAR(10),
        "notes" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Product category enum
    await queryRunner.query(`
      CREATE TYPE "products_category_enum" AS ENUM ('football', 'handball', 'lifestyle')
    `);

    // Products
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" SERIAL PRIMARY KEY,
        "supplier_id" INTEGER NOT NULL REFERENCES "suppliers"("id"),
        "article_number" VARCHAR(100) NOT NULL,
        "name" VARCHAR(150) NOT NULL,
        "category" "products_category_enum",
        "description" TEXT,
        "unit_price" NUMERIC(10,2) NOT NULL,
        "currency" VARCHAR(10),
        "moq" INTEGER,
        "weight_kg" NUMERIC(6,2),
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // PO status enum
    await queryRunner.query(`
      CREATE TYPE "purchase_orders_status_enum" AS ENUM (
        'draft', 'sent', 'confirmed', 'shipped', 'received', 'cancelled'
      )
    `);

    // Purchase orders
    await queryRunner.query(`
      CREATE TABLE "purchase_orders" (
        "id" SERIAL PRIMARY KEY,
        "po_number" VARCHAR(50) NOT NULL UNIQUE,
        "supplier_id" INTEGER NOT NULL REFERENCES "suppliers"("id"),
        "order_date" DATE NOT NULL,
        "expected_delivery" DATE,
        "status" "purchase_orders_status_enum" NOT NULL DEFAULT 'draft',
        "notes" TEXT,
        "total_value" NUMERIC(12,2),
        "currency" VARCHAR(10),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // PO line items
    await queryRunner.query(`
      CREATE TABLE "po_line_items" (
        "id" SERIAL PRIMARY KEY,
        "po_id" INTEGER NOT NULL REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
        "product_id" INTEGER REFERENCES "products"("id"),
        "article_number" VARCHAR(100) NOT NULL,
        "description" VARCHAR(255) NOT NULL,
        "quantity" INTEGER NOT NULL,
        "unit_price" NUMERIC(10,2) NOT NULL,
        "line_total" NUMERIC(12,2) NOT NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "po_line_items"`);
    await queryRunner.query(`DROP TABLE "purchase_orders"`);
    await queryRunner.query(`DROP TYPE "purchase_orders_status_enum"`);
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(`DROP TYPE "products_category_enum"`);
    await queryRunner.query(`DROP TABLE "suppliers"`);
  }
}
