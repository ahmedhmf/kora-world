import { MigrationInterface, QueryRunner } from 'typeorm';

export class EventDocumentsAndReports1795500000002 implements MigrationInterface {
  name = 'EventDocumentsAndReports1795500000002';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "event_documents" (
      "id" SERIAL PRIMARY KEY,
      "event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
      "category" varchar(32) NOT NULL,
      "original_name" varchar(255) NOT NULL,
      "stored_name" varchar(100) NOT NULL UNIQUE,
      "mime_type" varchar(120) NOT NULL,
      "size_bytes" integer NOT NULL CHECK ("size_bytes" > 0 AND "size_bytes" <= 15728640),
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query('CREATE INDEX "IDX_event_documents_event" ON "event_documents"("event_id")');
    await q.query(`CREATE TABLE "event_reports" (
      "id" SERIAL PRIMARY KEY,
      "event_id" integer NOT NULL UNIQUE REFERENCES "events"("id") ON DELETE CASCADE,
      "attendance" integer NULL CHECK ("attendance" >= 0),
      "summary" text NOT NULL DEFAULT '',
      "successes" text NOT NULL DEFAULT '',
      "problems" text NOT NULL DEFAULT '',
      "missing_equipment" text NOT NULL DEFAULT '',
      "lessons_learned" text NOT NULL DEFAULT '',
      "next_actions" text NOT NULL DEFAULT '',
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE "event_reports"');
    await q.query('DROP TABLE "event_documents"');
  }
}
