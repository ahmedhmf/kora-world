import { MigrationInterface, QueryRunner } from 'typeorm';

export class EventStockReservations1795550000004 implements MigrationInterface {
  name = 'EventStockReservations1795550000004';
  async up(q: QueryRunner) {
    await q.query(`
      CREATE TABLE event_stock_reservations (
        id SERIAL PRIMARY KEY,
        event_id integer NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
        warehouse_id integer NOT NULL REFERENCES warehouse_sites(id),
        location_id integer NOT NULL,
        product_id integer REFERENCES products(id),
        equipment_id integer REFERENCES warehouse_equipment(id),
        quantity integer NOT NULL CHECK(quantity > 0),
        starts_at timestamptz NOT NULL,
        ends_at timestamptz NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled')),
        created_by_id integer REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        cancelled_at timestamptz,
        cancelled_by_id integer REFERENCES users(id) ON DELETE SET NULL,
        CHECK(num_nonnulls(product_id,equipment_id)=1),
        CHECK(ends_at > starts_at),
        FOREIGN KEY(location_id,warehouse_id) REFERENCES warehouse_locations(id,warehouse_id)
      );
      CREATE INDEX idx_event_reservation_event ON event_stock_reservations(event_id,status);
      CREATE INDEX idx_event_reservation_product ON event_stock_reservations(location_id,product_id,starts_at,ends_at) WHERE status='active';
      CREATE INDEX idx_event_reservation_equipment ON event_stock_reservations(location_id,equipment_id,starts_at,ends_at) WHERE status='active';

      -- Peak simultaneous reservations, not the sum of all overlapping intervals.
      CREATE FUNCTION warehouse_reserved_peak(p_location integer,p_product integer,p_equipment integer,p_start timestamptz,p_end timestamptz,p_exclude_event integer DEFAULT NULL)
      RETURNS bigint LANGUAGE sql STABLE AS $$
        WITH relevant AS (
          SELECT starts_at,ends_at,quantity FROM event_stock_reservations
          WHERE status='active' AND location_id=p_location
          AND product_id IS NOT DISTINCT FROM p_product AND equipment_id IS NOT DISTINCT FROM p_equipment
          AND (p_exclude_event IS NULL OR event_id<>p_exclude_event)
          AND starts_at<p_end AND ends_at>p_start
        ), points AS (
          SELECT p_start AS t UNION SELECT starts_at FROM relevant WHERE starts_at>p_start
        )
        SELECT COALESCE(MAX((SELECT COALESCE(SUM(quantity),0) FROM relevant WHERE starts_at<=t AND ends_at>t)),0) FROM points
      $$;
      -- Physical stock reductions must preserve the largest future commitment.
      CREATE FUNCTION warehouse_protect_reserved_stock() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE p integer; e integer; remaining integer; reserved bigint;
      BEGIN
        IF TG_TABLE_NAME='warehouse_stock' THEN p:=OLD.product_id; ELSE e:=OLD.equipment_id; END IF;
        IF TG_OP='DELETE' THEN remaining:=0; ELSE remaining:=NEW.quantity; END IF;
        IF remaining<OLD.quantity THEN
          SELECT warehouse_reserved_peak(OLD.location_id,p,e,NOW(),'infinity'::timestamptz,NULL) INTO reserved;
          IF remaining<reserved THEN RAISE EXCEPTION 'Stock is reserved for upcoming events' USING ERRCODE='23514'; END IF;
        END IF;
        IF TG_OP='DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER protect_product_reservations BEFORE UPDATE OF quantity OR DELETE ON warehouse_stock FOR EACH ROW EXECUTE FUNCTION warehouse_protect_reserved_stock();
      CREATE TRIGGER protect_equipment_reservations BEFORE UPDATE OF quantity OR DELETE ON warehouse_equipment_stock FOR EACH ROW EXECUTE FUNCTION warehouse_protect_reserved_stock();
    `);
  }
  async down(q: QueryRunner) {
    const [r]=await q.query('SELECT COUNT(*) AS count FROM event_stock_reservations');
    if(Number(r.count)) throw new Error('Cannot revert while reservation history exists');
    await q.query(`DROP TRIGGER protect_product_reservations ON warehouse_stock;
      DROP TRIGGER protect_equipment_reservations ON warehouse_equipment_stock;
      DROP FUNCTION warehouse_protect_reserved_stock();
      DROP FUNCTION warehouse_reserved_peak(integer,integer,integer,timestamptz,timestamptz,integer);
      DROP TABLE event_stock_reservations;`);
  }
}
