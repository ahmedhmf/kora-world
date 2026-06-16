import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAttachmentToJournalEntries1750000000007 implements MigrationInterface {
  name = 'AddAttachmentToJournalEntries1750000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "journal_entries" 
      ADD COLUMN "attachment" VARCHAR(500) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "journal_entries" 
      DROP COLUMN "attachment"
    `);
  }
}
