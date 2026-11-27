import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { AppDataSource } from '../../data-source';
import { WarehouseService } from './warehouse.service';

const enabled = process.env.WAREHOUSE_INTEGRATION_TEST === '1';
(enabled ? describe : describe.skip)('Warehouse PostgreSQL integration', () => {
  let db: DataSource;
  let service: WarehouseService;
  let supplierId: number | undefined;
  let productId: number;
  let warehouseId: number | undefined;
  let a: number;
  let b: number;
  let userId: number;
  let verified = false;

  beforeAll(async () => {
    if (process.env.DATABASE_NAME !== 'kora_test' || AppDataSource.options.database !== 'kora_test')
      throw new Error('Explicit DATABASE_NAME=kora_test required');
    db = AppDataSource;
    await db.initialize();
    const [target] = await db.query('SELECT current_database() AS db');
    if (target.db !== 'kora_test') throw new Error('Unsafe database target');
    verified = true;
    service = new WarehouseService(db);
    const [user] = await db.query("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1");
    if (!user) throw new Error('Test database requires an admin user');
    userId = user.id;
    const key = randomUUID();
    const [supplier] = await db.query('INSERT INTO suppliers (name) VALUES ($1) RETURNING id', ['Warehouse test ' + key]);
    supplierId = supplier.id;
    const [product] = await db.query(
      'INSERT INTO products (supplier_id, article_number, name, unit_price) VALUES ($1,$2,$3,$4) RETURNING id',
      [supplierId, 'TEST-' + key, 'Warehouse test football', 1],
    );
    productId = product.id;
    const warehouse = await service.createWarehouse({ code: 'T-' + key, name: 'Warehouse test' });
    warehouseId = warehouse.id;
    a = (await service.createLocation(warehouse.id, { code: 'A', name: 'Shelf A' })).id;
    b = (await service.createLocation(warehouse.id, { code: 'B', name: 'Shelf B' })).id;
  }, 30000);

  afterAll(async () => {
    if (!db?.isInitialized) return;
    try {
      if (verified) await db.transaction(async manager => {
        if (warehouseId !== undefined) {
          await manager.query('DELETE FROM warehouse_movements WHERE warehouse_id = $1', [warehouseId]);
          await manager.query('DELETE FROM warehouse_stock WHERE location_id IN (SELECT id FROM warehouse_locations WHERE warehouse_id = $1)', [warehouseId]);
          await manager.query('DELETE FROM warehouse_locations WHERE warehouse_id = $1', [warehouseId]);
          await manager.query('DELETE FROM warehouse_sites WHERE id = $1', [warehouseId]);
        }
        if (productId !== undefined) await manager.query('DELETE FROM products WHERE id = $1', [productId]);
        if (supplierId !== undefined) await manager.query('DELETE FROM suppliers WHERE id = $1', [supplierId]);
      });
    } finally { await db.destroy(); }
  }, 30000);

  const site = () => warehouseId!;
  const record = (action: 'receipt' | 'issue' | 'return' | 'adjustment', quantity: number, notes?: string) =>
    service.record(site(), action, { locationId: a, productId, quantity, notes }, userId);
  const balance = async () => {
    const rows: Array<{ locationId: number; quantity: number }> = await service.stock(site());
    return { a: rows.find(r => r.locationId === a)?.quantity ?? 0, b: rows.find(r => r.locationId === b)?.quantity ?? 0 };
  };

  it('receives, issues, returns, adjusts and transfers with a matching ledger', async () => {
    expect((await record('receipt', 100)).quantityAfter).toBe(100);
    expect((await record('issue', 20)).quantityAfter).toBe(80);
    expect((await record('return', 5)).quantityAfter).toBe(85);
    expect((await record('adjustment', -3, 'Damaged')).quantityAfter).toBe(82);
    await service.transfer(site(), { fromLocationId: a, toLocationId: b, productId, quantity: 30 }, userId);
    expect(await balance()).toEqual({ a: 52, b: 30 });
    const rows: Array<{ quantityChange: number; performedById: number }> = await service.movements(site());
    expect(rows).toHaveLength(6);
    expect(rows.reduce((sum, r) => sum + r.quantityChange, 0)).toBe(82);
    expect(rows.every(r => r.performedById === userId)).toBe(true);
  });

  it('rejects invalid quantities, missing adjustment notes and overspending without changing stock', async () => {
    const before = await balance();
    const history = await service.movements(site());
    await expect(record('issue', before.a + 1)).rejects.toThrow('Insufficient');
    await expect(record('receipt', 0)).rejects.toThrow();
    await expect(record('receipt', -1)).rejects.toThrow();
    await expect(record('receipt', 1.5)).rejects.toThrow();
    await expect(record('adjustment', -1)).rejects.toThrow('explanation');
    await expect(service.transfer(site(), { fromLocationId: a, toLocationId: b, productId, quantity: before.a + 1 }, userId)).rejects.toThrow('Insufficient');
    expect(await balance()).toEqual(before);
    expect(await service.movements(site())).toEqual(history);
  });

  it('rolls back stock if the movement insert fails', async () => {
    const before = await balance();
    const history = await service.movements(site());
    await expect(service.record(site(), 'receipt', { locationId: a, productId, quantity: 1 }, 2147483647)).rejects.toThrow();
    expect(await balance()).toEqual(before);
    expect(await service.movements(site())).toEqual(history);
  });

  it('serializes competing issues so stock cannot become negative', async () => {
    const before = await balance();
    const history = await service.movements(site());
    const quantity = Math.floor(before.a / 2) + 1;
    const results = await Promise.allSettled([record('issue', quantity), record('issue', quantity)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect(await balance()).toEqual({ a: before.a - quantity, b: before.b });
    expect(await service.movements(site())).toHaveLength(history.length + 1);
  });
});
