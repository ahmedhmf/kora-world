import { MigrationInterface, QueryRunner } from 'typeorm';
export class CustomerReturnsEquipment1795550000003 implements MigrationInterface {
  name = 'CustomerReturnsEquipment1795550000003';
  async up(q: QueryRunner) {
    await q.query(`
      CREATE TABLE warehouse_customer_returns (
        id SERIAL PRIMARY KEY,
        account_id integer NOT NULL REFERENCES accounts(id),
        adjustment_id integer NOT NULL UNIQUE REFERENCES inventory_adjustments(id),
        warehouse_id integer NOT NULL REFERENCES warehouse_sites(id),
        location_id integer NOT NULL,
        product_id integer NOT NULL REFERENCES products(id),
        quantity integer NOT NULL CHECK (quantity > 0),
        request_key uuid NOT NULL UNIQUE,
        notes text NOT NULL,
        performed_by_id integer REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        FOREIGN KEY(location_id,warehouse_id) REFERENCES warehouse_locations(id,warehouse_id)
      );
      CREATE INDEX idx_customer_returns_account ON warehouse_customer_returns(account_id,id);
      CREATE TABLE warehouse_equipment (
        id SERIAL PRIMARY KEY, code varchar(40) NOT NULL UNIQUE, name varchar(160) NOT NULL,
        category varchar(100), description text, created_at timestamptz NOT NULL DEFAULT NOW()
      );
      CREATE TABLE warehouse_equipment_stock (
        equipment_id integer NOT NULL REFERENCES warehouse_equipment(id),
        location_id integer NOT NULL REFERENCES warehouse_locations(id),
        quantity integer NOT NULL DEFAULT 0 CHECK(quantity >= 0),
        PRIMARY KEY(equipment_id,location_id)
      );
      CREATE TABLE warehouse_equipment_movements (
        id BIGSERIAL PRIMARY KEY, equipment_id integer NOT NULL REFERENCES warehouse_equipment(id),
        warehouse_id integer NOT NULL REFERENCES warehouse_sites(id), location_id integer NOT NULL,
        quantity_change integer NOT NULL CHECK(quantity_change <> 0),
        movement_type varchar(30) NOT NULL CHECK(movement_type IN ('receipt','issue','return','adjustment','transfer_in','transfer_out')),
        reference varchar(160), notes text, performed_by_id integer REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        FOREIGN KEY(location_id,warehouse_id) REFERENCES warehouse_locations(id,warehouse_id)
      );
      CREATE INDEX idx_equipment_movements_site ON warehouse_equipment_movements(warehouse_id,id DESC);
    `);
  }
  async down(q: QueryRunner) {
    const [r] = await q.query('SELECT (SELECT COUNT(*) FROM warehouse_customer_returns)+(SELECT COUNT(*) FROM warehouse_equipment) AS count');
    if (Number(r.count)) throw new Error('Cannot revert while customer returns or equipment records exist');
    await q.query('DROP TABLE warehouse_equipment_movements; DROP TABLE warehouse_equipment_stock; DROP TABLE warehouse_equipment; DROP TABLE warehouse_customer_returns');
  }
}
