import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEventOfferFiles1795500000001 implements MigrationInterface {
  name = 'CreateEventOfferFiles1795500000001';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "event_offer_files" (
      "id" SERIAL PRIMARY KEY,
      "offer_id" integer NOT NULL REFERENCES "event_offers"("id") ON DELETE CASCADE,
      "stored_name" varchar(100) NOT NULL UNIQUE,
      "original_name" varchar(255) NOT NULL,
      "mime_type" varchar(120) NOT NULL,
      "size_bytes" integer NOT NULL CHECK ("size_bytes" >= 0 AND "size_bytes" <= 15728640),
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query('CREATE INDEX "IDX_event_offer_files_offer" ON "event_offer_files"("offer_id")');
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE "event_offer_files"');
  }
}
