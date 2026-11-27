import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeliveryWarehouseDispatch1795550000002 implements MigrationInterface {
  name = 'DeliveryWarehouseDispatch1795550000002';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE delivery_notes
        ADD COLUMN delivery_source varchar(20) NOT NULL DEFAULT 'legacy',
        ADD COLUMN source_details varchar(200),
        ADD COLUMN warehouse_id integer REFERENCES warehouse_sites(id),
        ADD COLUMN location_id integer,
        ADD COLUMN dispatched_at timestamptz,
        ADD COLUMN dispatched_by_id integer REFERENCES users(id) ON DELETE SET NULL,
        ADD CONSTRAINT delivery_source_valid CHECK (delivery_source IN ('legacy','warehouse','supplier','external')),
        ADD CONSTRAINT delivery_source_location CHECK (
          (delivery_source = 'warehouse' AND warehouse_id IS NOT NULL AND location_id IS NOT NULL AND source_details IS NULL)
          OR (delivery_source IN ('supplier','external') AND warehouse_id IS NULL AND location_id IS NULL AND NULLIF(BTRIM(source_details),'') IS NOT NULL)
          OR (delivery_source = 'legacy' AND warehouse_id IS NULL AND location_id IS NULL)
        ),
        ADD CONSTRAINT delivery_source_location_fk FOREIGN KEY (location_id,warehouse_id) REFERENCES warehouse_locations(id,warehouse_id),
        ADD CONSTRAINT delivery_signed_dispatch CHECK (delivery_source <> 'warehouse' OR signed_file_path IS NULL OR dispatched_at IS NOT NULL);
      ALTER TABLE delivery_notes ALTER COLUMN delivery_source DROP DEFAULT;
    `);
  }
  async down(q: QueryRunner): Promise<void> {
    const [r] = await q.query("SELECT COUNT(*)::int AS count FROM delivery_notes WHERE delivery_source <> 'legacy'");
    if (r.count) throw new Error('Cannot revert while tracked delivery notes exist');
    await q.query(`ALTER TABLE delivery_notes DROP CONSTRAINT delivery_signed_dispatch,
      DROP CONSTRAINT delivery_source_location_fk, DROP CONSTRAINT delivery_source_location, DROP CONSTRAINT delivery_source_valid,
      DROP COLUMN dispatched_by_id, DROP COLUMN dispatched_at, DROP COLUMN location_id, DROP COLUMN warehouse_id,
      DROP COLUMN source_details, DROP COLUMN delivery_source`);
  }
}
