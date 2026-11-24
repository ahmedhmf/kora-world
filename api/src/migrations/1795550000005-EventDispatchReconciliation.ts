import { MigrationInterface, QueryRunner } from 'typeorm';
export class EventDispatchReconciliation1795550000005 implements MigrationInterface {
 name='EventDispatchReconciliation1795550000005';
 async up(q:QueryRunner){
  await q.query(`
   ALTER TABLE event_stock_reservations DROP CONSTRAINT event_stock_reservations_status_check;
   ALTER TABLE event_stock_reservations ADD CONSTRAINT event_stock_reservations_status_check CHECK(status IN ('active','cancelled','dispatched','reconciled'));
   ALTER TABLE event_stock_reservations ADD COLUMN dispatched_at timestamptz, ADD COLUMN dispatched_by_id integer REFERENCES users(id) ON DELETE SET NULL;
   CREATE TABLE event_stock_reconciliations (
    reservation_id integer PRIMARY KEY REFERENCES event_stock_reservations(id) ON DELETE RESTRICT,
    returned integer NOT NULL CHECK(returned>=0), damaged integer NOT NULL CHECK(damaged>=0),
    missing integer NOT NULL CHECK(missing>=0), consumed integer NOT NULL CHECK(consumed>=0),
    notes text NOT NULL, performed_by_id integer REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT NOW()
   );
  `);
 }
 async down(q:QueryRunner){
  const [r]=await q.query("SELECT COUNT(*) AS count FROM event_stock_reservations WHERE status IN ('dispatched','reconciled')");
  if(Number(r.count))throw new Error('Cannot revert posted event logistics');
  await q.query(`DROP TABLE event_stock_reconciliations;
   ALTER TABLE event_stock_reservations DROP COLUMN dispatched_at,DROP COLUMN dispatched_by_id;
   ALTER TABLE event_stock_reservations DROP CONSTRAINT event_stock_reservations_status_check;
   ALTER TABLE event_stock_reservations ADD CONSTRAINT event_stock_reservations_status_check CHECK(status IN ('active','cancelled'));`);
 }
}
