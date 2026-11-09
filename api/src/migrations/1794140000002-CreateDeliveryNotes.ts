import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDeliveryNotes1794140000002 implements MigrationInterface {
  name = 'CreateDeliveryNotes1794140000002';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "delivery_notes" (
      "id" SERIAL PRIMARY KEY,
      "account_id" INTEGER NOT NULL REFERENCES "accounts"("id") ON DELETE RESTRICT,
      "note_number" VARCHAR(40) NOT NULL UNIQUE,
      "delivery_date" DATE NOT NULL,
      "customer_name" VARCHAR(150) NOT NULL,
      "delivery_address" TEXT,
      "payment_model" VARCHAR(150),
      "items" JSONB NOT NULL,
      "remarks" TEXT,
      "signed_file_path" VARCHAR(255),
      "signed_file_name" VARCHAR(255),
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_delivery_notes_account_id" ON "delivery_notes"("account_id")`);
  }

  public async down(_q: QueryRunner): Promise<void> {
    // Retain signed delivery evidence; destructive rollback must be reviewed separately.
  }
}
