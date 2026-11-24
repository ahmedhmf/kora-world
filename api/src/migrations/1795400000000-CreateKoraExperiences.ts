import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKoraExperiences1795400000000 implements MigrationInterface {
  name = 'CreateKoraExperiences1795400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "kora_experiences" (
      "id" SERIAL PRIMARY KEY, "name" VARCHAR(160) NOT NULL,
      "description" TEXT, "items" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "active" BOOLEAN NOT NULL DEFAULT TRUE,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE TABLE "event_kora_experiences" (
      "id" SERIAL PRIMARY KEY,
      "event_id" INTEGER NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
      "experience_id" INTEGER NOT NULL REFERENCES "kora_experiences"("id") ON DELETE CASCADE,
      CONSTRAINT "UQ_event_kora_experience" UNIQUE ("event_id", "experience_id")
    )`);
    await q.query(`CREATE TABLE "event_kora_checklists" (
      "id" SERIAL PRIMARY KEY,
      "event_id" INTEGER NOT NULL UNIQUE REFERENCES "events"("id") ON DELETE CASCADE,
      "items" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE "event_kora_checklists"');
    await q.query('DROP TABLE "event_kora_experiences"');
    await q.query('DROP TABLE "kora_experiences"');
  }
}
