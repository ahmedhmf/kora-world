import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWarehouseFoundation1795550000000 implements MigrationInterface {
  name = 'CreateWarehouseFoundation1795550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE warehouse_sites (
        id SERIAL PRIMARY KEY,
        code VARCHAR(40) NOT NULL UNIQUE,
        name VARCHAR(160) NOT NULL,
        address TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE warehouse_locations (
        id SERIAL PRIMARY KEY,
        warehouse_id INTEGER NOT NULL REFERENCES warehouse_sites(id) ON DELETE RESTRICT,
        code VARCHAR(40) NOT NULL,
        name VARCHAR(160) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (warehouse_id, code),
        UNIQUE (id, warehouse_id)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE warehouse_stock (
        location_id INTEGER NOT NULL REFERENCES warehouse_locations(id) ON DELETE RESTRICT,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
        PRIMARY KEY (location_id, product_id)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE warehouse_movements (
        id BIGSERIAL PRIMARY KEY,
        warehouse_id INTEGER NOT NULL REFERENCES warehouse_sites(id) ON DELETE RESTRICT,
        location_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        quantity_change INTEGER NOT NULL CHECK (quantity_change <> 0),
        movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN ('receipt','adjustment','transfer_in','transfer_out','issue','return')),
        reference VARCHAR(160),
        notes TEXT,
        performed_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        FOREIGN KEY (location_id, warehouse_id) REFERENCES warehouse_locations(id, warehouse_id) ON DELETE RESTRICT
      )
    `);
    await queryRunner.query('CREATE INDEX idx_warehouse_movements_product_time ON warehouse_movements(product_id, created_at DESC)');
    await queryRunner.query('CREATE INDEX idx_warehouse_movements_warehouse_time ON warehouse_movements(warehouse_id, created_at DESC)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE warehouse_movements');
    await queryRunner.query('DROP TABLE warehouse_stock');
    await queryRunner.query('DROP TABLE warehouse_locations');
    await queryRunner.query('DROP TABLE warehouse_sites');
  }
}
