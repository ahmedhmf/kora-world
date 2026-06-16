import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateB2cRequests1750000000020 implements MigrationInterface {
  name = 'CreateB2cRequests1750000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "b2c_requests" (
        "id" SERIAL PRIMARY KEY,
        "customer_name" VARCHAR(150) NOT NULL,
        "channel" VARCHAR(50) NOT NULL, -- instagram, facebook, whatsapp, other
        "channel_username" VARCHAR(150),
        "phone" VARCHAR(50),
        "email" VARCHAR(150),
        "product_id" INTEGER REFERENCES "products"("id") ON DELETE SET NULL,
        "requested_size" VARCHAR(50),
        "requested_color" VARCHAR(50),
        "quantity" INTEGER NOT NULL DEFAULT 1,
        "status" VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, notified, fulfilled, cancelled
        "notes" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "b2c_requests"`);
  }
}
