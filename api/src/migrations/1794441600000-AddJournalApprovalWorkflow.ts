import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive workflow tracking; legacy entries remain posted. */
export class AddJournalApprovalWorkflow1794441600000 implements MigrationInterface {
  name = 'AddJournalApprovalWorkflow1794441600000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "journal_entries"
      ADD COLUMN "created_by_id" INTEGER,
      ADD COLUMN "submitted_by_id" INTEGER,
      ADD COLUMN "submitted_at" TIMESTAMPTZ,
      ADD COLUMN "approved_by_id" INTEGER,
      ADD COLUMN "reversed_by_id" INTEGER,
      ADD COLUMN "reversed_at" TIMESTAMPTZ
    `);
    await q.query(`
      CREATE UNIQUE INDEX "uq_journal_one_reversal"
      ON "journal_entries" ("reversal_of_id")
      WHERE "reversal_of_id" IS NOT NULL
    `);
    await q.query(`
      ALTER TABLE "journal_entries"
      ADD CONSTRAINT "fk_journal_creator" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT,
      ADD CONSTRAINT "fk_journal_submitter" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT,
      ADD CONSTRAINT "fk_journal_approver" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT,
      ADD CONSTRAINT "fk_journal_reverser" FOREIGN KEY ("reversed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE "journal_entries" DROP CONSTRAINT "fk_journal_reverser"');
    await q.query('ALTER TABLE "journal_entries" DROP CONSTRAINT "fk_journal_approver"');
    await q.query('ALTER TABLE "journal_entries" DROP CONSTRAINT "fk_journal_submitter"');
    await q.query('ALTER TABLE "journal_entries" DROP CONSTRAINT "fk_journal_creator"');
    await q.query('DROP INDEX "uq_journal_one_reversal"');
    await q.query('ALTER TABLE "journal_entries" DROP COLUMN "reversed_at"');
    await q.query('ALTER TABLE "journal_entries" DROP COLUMN "reversed_by_id"');
    await q.query('ALTER TABLE "journal_entries" DROP COLUMN "approved_by_id"');
    await q.query('ALTER TABLE "journal_entries" DROP COLUMN "submitted_at"');
    await q.query('ALTER TABLE "journal_entries" DROP COLUMN "submitted_by_id"');
    await q.query('ALTER TABLE "journal_entries" DROP COLUMN "created_by_id"');
  }
}
