import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive foundation for the new accounting posting engine.
 * Does not delete existing data, modify old invoices/payments, or reseed accounts.
 */
export class AddAccountingPostingFoundation1794355200000 implements MigrationInterface {
  name = 'AddAccountingPostingFoundation1794355200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "journal_entries"
      ADD COLUMN "posting_status" VARCHAR(32) NOT NULL DEFAULT 'posted',
      ADD COLUMN "source_event_key" VARCHAR(255),
      ADD COLUMN "posted_at" TIMESTAMPTZ,
      ADD COLUMN "reversal_of_id" INTEGER
    `);
    await queryRunner.query(`
      ALTER TABLE "journal_entries"
      ADD CONSTRAINT "fk_journal_reversal" FOREIGN KEY ("reversal_of_id")
      REFERENCES "journal_entries"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_journal_source_event"
      ON "journal_entries" ("source_event_key")
      WHERE "source_event_key" IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "journal_entries" ADD CONSTRAINT "chk_journal_posting_status"
      CHECK ("posting_status" IN ('draft','pending_approval','posted','reversed'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "journal_entries" DROP CONSTRAINT "chk_journal_posting_status"');
    await queryRunner.query('DROP INDEX "uq_journal_source_event"');
    await queryRunner.query('ALTER TABLE "journal_entries" DROP CONSTRAINT "fk_journal_reversal"');
    await queryRunner.query('ALTER TABLE "journal_entries" DROP COLUMN "reversal_of_id"');
    await queryRunner.query('ALTER TABLE "journal_entries" DROP COLUMN "posted_at"');
    await queryRunner.query('ALTER TABLE "journal_entries" DROP COLUMN "source_event_key"');
    await queryRunner.query('ALTER TABLE "journal_entries" DROP COLUMN "posting_status"');
  }
}
