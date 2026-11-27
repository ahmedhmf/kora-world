import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGoodsReceipts1795550000001 implements MigrationInterface {
  name = 'CreateGoodsReceipts1795550000001';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE warehouse_goods_receipts (
        id SERIAL PRIMARY KEY,
        po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
        warehouse_id INTEGER NOT NULL REFERENCES warehouse_sites(id) ON DELETE RESTRICT,
        location_id INTEGER NOT NULL,
        request_key UUID NOT NULL UNIQUE,
        supplier_reference VARCHAR(160),
        notes TEXT,
        performed_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        FOREIGN KEY (location_id, warehouse_id) REFERENCES warehouse_locations(id, warehouse_id)
      );
      CREATE TABLE warehouse_goods_receipt_lines (
        receipt_id INTEGER NOT NULL REFERENCES warehouse_goods_receipts(id) ON DELETE RESTRICT,
        po_line_id INTEGER NOT NULL REFERENCES po_line_items(id) ON DELETE RESTRICT,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        PRIMARY KEY (receipt_id, po_line_id)
      );
      CREATE INDEX idx_goods_receipts_po ON warehouse_goods_receipts(po_id);
      CREATE INDEX idx_goods_receipt_lines_po_line ON warehouse_goods_receipt_lines(po_line_id);
    `);
    await q.query(`
      CREATE FUNCTION guard_warehouse_po_status() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          IF NEW.status = 'received' THEN RAISE EXCEPTION 'Use Goods Receipts to receive purchase orders'; END IF;
          RETURN NEW;
        END IF;
        IF NEW.status IS DISTINCT FROM OLD.status THEN
          IF NEW.status = 'received' AND (
            NOT EXISTS (SELECT 1 FROM po_line_items WHERE po_id = NEW.id)
            OR EXISTS (
              SELECT 1 FROM po_line_items l WHERE l.po_id = NEW.id AND
              l.quantity <> COALESCE((SELECT SUM(r.quantity) FROM warehouse_goods_receipt_lines r WHERE r.po_line_id = l.id), 0)
            )
          ) THEN RAISE EXCEPTION 'Use Goods Receipts to receive purchase orders'; END IF;
          IF EXISTS (SELECT 1 FROM warehouse_goods_receipts WHERE po_id = NEW.id)
             AND NEW.status <> 'received' THEN
            RAISE EXCEPTION 'Cannot change status of an order with goods receipts';
          END IF;
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER warehouse_po_status_guard BEFORE INSERT OR UPDATE OF status ON purchase_orders
      FOR EACH ROW EXECUTE FUNCTION guard_warehouse_po_status();
    `);
  }
  async down(q: QueryRunner): Promise<void> {
    const [r] = await q.query('SELECT COUNT(*)::int AS count FROM warehouse_goods_receipts');
    if (r.count) throw new Error('Cannot revert goods receipts while records exist');
    await q.query('DROP TRIGGER warehouse_po_status_guard ON purchase_orders');
    await q.query('DROP FUNCTION guard_warehouse_po_status()');
    await q.query('DROP TABLE warehouse_goods_receipt_lines');
    await q.query('DROP TABLE warehouse_goods_receipts');
  }
}
