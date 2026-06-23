import { MigrationInterface, QueryRunner } from 'typeorm';

export class PopulateSampleArticleNumbers1750000000014 implements MigrationInterface {
  name = 'PopulateSampleArticleNumbers1750000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const samples = (await queryRunner.query(
      `SELECT id, category, "created_at" FROM "samples" ORDER BY id ASC`,
    )) as Array<{
      id: number;
      category: string | null;
      created_at: string | Date | null;
    }>;

    const counters = new Map<string, number>(); // key: 'year_category'

    for (const sample of samples) {
      const createdAt = new Date(sample.created_at || new Date());
      const year = createdAt.getFullYear();
      const yearStr = String(year).slice(-2);
      const category = sample.category || 'other';

      const key = `${year}_${category}`;
      const counter = (counters.get(key) || 0) + 1;
      counters.set(key, counter);

      let catCode = 'OTH';
      if (category === 'football') catCode = 'FB';
      else if (category === 'handball') catCode = 'HB';
      else if (category === 'lifestyle') catCode = 'APP';

      const counterStr = String(counter).padStart(3, '0');
      const articleNumber = `SP${yearStr}${counterStr}${catCode}`;

      await queryRunner.query(
        `UPDATE "samples" SET "year" = $1, "article_counter" = $2, "article_number" = $3 WHERE "id" = $4`,
        [year, counter, articleNumber, sample.id],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "samples" SET "year" = NULL, "article_counter" = NULL, "article_number" = NULL`,
    );
  }
}
