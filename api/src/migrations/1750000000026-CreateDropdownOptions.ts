import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDropdownOptions1750000000026 implements MigrationInterface {
  name = 'CreateDropdownOptions1750000000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the table
    await queryRunner.query(`
      CREATE TABLE "dropdown_options" (
        "id" SERIAL PRIMARY KEY,
        "category" VARCHAR(50) NOT NULL,
        "value" VARCHAR(150) NOT NULL,
        CONSTRAINT "UQ_category_value" UNIQUE ("category", "value")
      )
    `);

    // Seed default values
    const defaultOptions = [
      // Currency
      { category: 'currency', value: 'EGP' },
      { category: 'currency', value: 'USD' },
      { category: 'currency', value: 'EUR' },
      
      // Bonding
      { category: 'bonding', value: 'machine stitched' },
      { category: 'bonding', value: 'hand stitched' },
      { category: 'bonding', value: 'hybrid' },
      { category: 'bonding', value: 'thermal bonding' },

      // Pricepoint
      { category: 'pricepoint', value: 'Club' },
      { category: 'pricepoint', value: 'Training' },
      { category: 'pricepoint', value: 'League' },
      { category: 'pricepoint', value: 'Competition' },
      { category: 'pricepoint', value: 'Match Pro' },

      // Backing
      { category: 'backing', value: '4 layers poly-cotton' },

      // Bladder
      { category: 'bladder', value: 'SR bladder' },
      { category: 'bladder', value: 'Latex bladder' },

      // Cover Material
      { category: 'coverMaterial', value: 'PU leather' },
      { category: 'coverMaterial', value: 'TPU' },
    ];

    for (const opt of defaultOptions) {
      await queryRunner.query(
        `INSERT INTO "dropdown_options" ("category", "value") VALUES ($1, $2)`,
        [opt.category, opt.value],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "dropdown_options"`);
  }
}
