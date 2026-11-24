import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { AppDataSource as db } from '../../data-source';
import { GoodsReceiptsService } from './goods-receipts.service';
import { WarehouseService } from './warehouse.service';

(process.env.WAREHOUSE_INTEGRATION_TEST === '1' ? describe : describe.skip)('Goods receipts PostgreSQL integration', () => {
  let verified = false;
  let supplierId: number | undefined;
  let productId: number | undefined;
  let poId: number | undefined;
  let warehouseId: number | undefined;
  let locationId: number;
  let lineId: number;
  let userId: number;
  let service: GoodsReceiptsService;

  beforeAll(async () => {
    if (process.env.DATABASE_NAME !== 'kora_test' || db.options.database !== 'kora_test') throw new Error('Explicit kora_test required');
    await db.initialize();
    const [target] = await db.query('SELECT current_database() AS db');
    if (target.db !== 'kora_test') throw new Error('Unsafe database target');
    verified = true;
    service = new GoodsReceiptsService(db);
    const [user] = await db.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (!user) throw new Error('Test admin required');
    userId = user.id;
    const key = randomUUID();
    const [supplier] = await db.query('INSERT INTO suppliers (name) VALUES ($1) RETURNING id', ['GR test ' + key]);
    supplierId = supplier.id;
    const [product] = await db.query('INSERT INTO products (supplier_id,article_number,name,unit_price) VALUES ($1,$2,$3,1) RETURNING id', [supplierId, 'GR-' + key, 'Test football']);
    productId = product.id;
    const [po] = await db.query("INSERT INTO purchase_orders (po_number,supplier_id,order_date,status) VALUES ($1,$2,CURRENT_DATE,'confirmed') RETURNING id", ['GR-' + key,supplierId]);
    poId = po.id;
    const [line] = await db.query('INSERT INTO po_line_items (po_id,product_id,article_number,description,quantity,unit_price,line_total) VALUES ($1,$2,$3,$4,100,1,100) RETURNING id', [poId,productId,'GR-' + key,'Test football']);
    lineId = line.id;
    const warehouse = new WarehouseService(db);
    const site = await warehouse.createWarehouse({code:'G-' + key,name:'GR test'});
    warehouseId = site.id;
    locationId = (await warehouse.createLocation(site.id,{code:'A',name:'Shelf A'})).id;
  }, 30000);

  afterAll(async () => {
    if (!db.isInitialized) return;
    try {
      if (verified) await db.transaction(async m => {
        if (poId !== undefined) {
          await m.query('DELETE FROM warehouse_goods_receipt_lines WHERE receipt_id IN (SELECT id FROM warehouse_goods_receipts WHERE po_id=$1)',[poId]);
          await m.query('DELETE FROM warehouse_goods_receipts WHERE po_id=$1',[poId]);
          await m.query('DELETE FROM purchase_orders WHERE id=$1',[poId]);
        }
        if (warehouseId !== undefined) {
          await m.query('DELETE FROM warehouse_movements WHERE warehouse_id=$1',[warehouseId]);
          await m.query('DELETE FROM warehouse_stock WHERE location_id IN (SELECT id FROM warehouse_locations WHERE warehouse_id=$1)',[warehouseId]);
          await m.query('DELETE FROM warehouse_locations WHERE warehouse_id=$1',[warehouseId]);
          await m.query('DELETE FROM warehouse_sites WHERE id=$1',[warehouseId]);
        }
        if (productId !== undefined) await m.query('DELETE FROM products WHERE id=$1',[productId]);
        if (supplierId !== undefined) await m.query('DELETE FROM suppliers WHERE id=$1',[supplierId]);
      });
    } finally { await db.destroy(); }
  }, 30000);

  const payload = (quantity: number, requestKey = randomUUID()) => ({warehouseId:warehouseId!,locationId,requestKey,lines:[{poLineId:lineId,quantity}]});
  const stock = async () => {
    const [row] = await db.query('SELECT quantity FROM warehouse_stock WHERE location_id=$1 AND product_id=$2',[locationId,productId]);
    return row?.quantity ?? 0;
  };
  it('posts partial receipt, makes duplicate retry harmless, and completes only after remaining stock is received', async () => {
    const first = payload(60);
    await service.receive(poId!,first,userId);
    expect(await stock()).toBe(60);
    expect((await service.overview(poId!)).lines[0].remaining).toBe(40);
    expect((await service.receive(poId!,first,userId)).duplicate).toBe(true);
    await expect(service.receive(poId!,{...first,lines:[{poLineId:lineId,quantity:61}]},userId)).rejects.toThrow('Request key');
    await expect(service.receive(poId!,payload(41),userId)).rejects.toThrow('remaining');
    expect(await stock()).toBe(60);
    await expect(db.query("UPDATE purchase_orders SET status='received' WHERE id=$1",[poId])).rejects.toThrow();
    await expect(db.query("UPDATE purchase_orders SET status='cancelled' WHERE id=$1",[poId])).rejects.toThrow();
    const concurrent = await Promise.allSettled([service.receive(poId!,payload(40),userId),service.receive(poId!,payload(40),userId)]);
    expect(concurrent.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect(await stock()).toBe(100);
    const final = await service.overview(poId!);
    expect(final.status).toBe('received');
    expect(final.receipts).toHaveLength(2);
    expect(final.lines[0].remaining).toBe(0);
    const [ledger] = await db.query('SELECT SUM(quantity_change)::int AS total FROM warehouse_movements WHERE warehouse_id=$1',[warehouseId]);
    expect(ledger.total).toBe(100);
  });
});
