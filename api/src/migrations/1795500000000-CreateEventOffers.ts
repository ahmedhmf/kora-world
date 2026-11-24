import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEventOffers1795500000000 implements MigrationInterface {
  name = 'CreateEventOffers1795500000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "event_offers" (
      "id" SERIAL PRIMARY KEY,
      "event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
      "type" varchar(16) NOT NULL CHECK ("type" IN ('staff', 'supplier')),
      "recipient_name" varchar(160) NOT NULL,
      "supplier_id" integer NULL REFERENCES "suppliers"("id") ON DELETE SET NULL,
      "description" varchar(200) NOT NULL,
      "quantity" integer NOT NULL CHECK ("quantity" > 0),
      "unit" varchar(32) NOT NULL,
      "unit_rate_cents" bigint NOT NULL CHECK ("unit_rate_cents" >= 0),
      "total_cents" bigint NOT NULL CHECK ("total_cents" >= 0),
      "currency" varchar(3) NOT NULL,
      "status" varchar(16) NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'sent', 'accepted', 'rejected')),
      "notes" text NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query('CREATE INDEX "IDX_event_offers_event" ON "event_offers"("event_id")');
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE "event_offers"');
  }
}
