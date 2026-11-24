import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

type StockAction = 'receipt' | 'issue' | 'return' | 'adjustment';
type StockInput = { locationId: number; productId: number; quantity: number; reference?: string; notes?: string };

@Injectable()
export class WarehouseService {
  constructor(private readonly db: DataSource) {}

  private positiveId(value: number, field: string): void {
    if (!Number.isSafeInteger(value) || value < 1) throw new BadRequestException('Invalid ' + field);
  }

  async warehouses() {
    return this.db.query('SELECT * FROM warehouse_sites ORDER BY name, id');
  }

  async createWarehouse(dto: { code: string; name: string; address?: string }) {
    if (!/^[A-Za-z0-9_-]{2,40}$/.test(dto?.code || '') || !dto?.name?.trim() || dto.name.trim().length > 160)
      throw new BadRequestException('Provide a valid warehouse code and name');
    const rows = await this.db.query(
      'INSERT INTO warehouse_sites (code, name, address) VALUES ($1, $2, $3) RETURNING *',
      [dto.code.trim().toUpperCase(), dto.name.trim(), dto.address?.trim() || null],
    );
    return rows[0];
  }

  async locations(warehouseId: number) {
    this.positiveId(warehouseId, 'warehouse');
    if (!(await this.db.query('SELECT id FROM warehouse_sites WHERE id = $1', [warehouseId])).length)
      throw new NotFoundException('Warehouse not found');
    return this.db.query('SELECT * FROM warehouse_locations WHERE warehouse_id = $1 ORDER BY code', [warehouseId]);
  }

  async createLocation(warehouseId: number, dto: { code: string; name: string }) {
    this.positiveId(warehouseId, 'warehouse');
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(dto?.code || '') || !dto?.name?.trim() || dto.name.trim().length > 160)
      throw new BadRequestException('Provide a valid location code and name');
    const warehouse = await this.db.query('SELECT id FROM warehouse_sites WHERE id = $1 AND is_active', [warehouseId]);
    if (!warehouse.length) throw new NotFoundException('Active warehouse not found');
    const rows = await this.db.query(
      'INSERT INTO warehouse_locations (warehouse_id, code, name) VALUES ($1, $2, $3) RETURNING *',
      [warehouseId, dto.code.trim().toUpperCase(), dto.name.trim()],
    );
    return rows[0];
  }

  async stock(warehouseId: number) {
    this.positiveId(warehouseId, 'warehouse');
    if (!(await this.db.query('SELECT id FROM warehouse_sites WHERE id = $1', [warehouseId])).length)
      throw new NotFoundException('Warehouse not found');
    return this.db.query(`
      SELECT l.id AS "locationId", l.code AS "locationCode", p.id AS "productId",
             p.article_number AS "articleNumber", p.name AS "productName", s.quantity
      FROM warehouse_stock s
      JOIN warehouse_locations l ON l.id = s.location_id
      JOIN products p ON p.id = s.product_id
      WHERE l.warehouse_id = $1 ORDER BY l.code, p.article_number
    `, [warehouseId]);
  }

  async movements(warehouseId: number) {
    this.positiveId(warehouseId, 'warehouse');
    if (!(await this.db.query('SELECT id FROM warehouse_sites WHERE id = $1', [warehouseId])).length)
      throw new NotFoundException('Warehouse not found');
    return this.db.query(`
      SELECT m.id::text, m.location_id AS "locationId", m.product_id AS "productId",
             m.quantity_change AS "quantityChange", m.movement_type AS "type",
             m.reference, m.notes, m.performed_by_id AS "performedById", m.created_at AS "createdAt"
      FROM warehouse_movements m WHERE m.warehouse_id = $1 ORDER BY m.id DESC LIMIT 500
    `, [warehouseId]);
  }

  async record(warehouseId: number, action: StockAction, dto: StockInput, userId: number) {
    this.positiveId(warehouseId, 'warehouse');
    this.positiveId(dto?.locationId, 'location');
    this.positiveId(dto?.productId, 'product');
    this.positiveId(userId, 'user');
    if (!Number.isSafeInteger(dto.quantity) || dto.quantity === 0 || Math.abs(dto.quantity) > 100000)
      throw new BadRequestException('Quantity must be a non-zero whole number within 100000');
    if (action !== 'adjustment' && dto.quantity < 0)
      throw new BadRequestException('Quantity must be positive for this operation');
    if (action === 'adjustment' && !dto.notes?.trim())
      throw new BadRequestException('Adjustments require an explanation');
    if ((dto.reference?.length || 0) > 160 || (dto.notes?.length || 0) > 2000)
      throw new BadRequestException('Reference or notes too long');
    const delta = action === 'issue' ? -dto.quantity : dto.quantity;
    return this.db.transaction(async manager => {
      const location = await manager.query(`
        SELECT l.id FROM warehouse_locations l JOIN warehouse_sites w ON w.id = l.warehouse_id
        WHERE l.id = $1 AND l.warehouse_id = $2 AND l.is_active AND w.is_active
      `, [dto.locationId, warehouseId]);
      if (!location.length) throw new NotFoundException('Active warehouse location not found');
      if (!(await manager.query('SELECT id FROM products WHERE id = $1', [dto.productId])).length)
        throw new NotFoundException('Product not found');
      await manager.query(`
        INSERT INTO warehouse_stock (location_id, product_id, quantity)
        VALUES ($1, $2, 0) ON CONFLICT (location_id, product_id) DO NOTHING
      `, [dto.locationId, dto.productId]);
      const [balance] = await manager.query(
        'SELECT quantity FROM warehouse_stock WHERE location_id = $1 AND product_id = $2 FOR UPDATE',
        [dto.locationId, dto.productId],
      );
      if (balance.quantity + delta < 0) throw new BadRequestException('Insufficient warehouse stock');
      await manager.query(
        'UPDATE warehouse_stock SET quantity = quantity + $3 WHERE location_id = $1 AND product_id = $2',
        [dto.locationId, dto.productId, delta],
      );
      const [movement] = await manager.query(`
        INSERT INTO warehouse_movements
          (warehouse_id, location_id, product_id, quantity_change, movement_type, reference, notes, performed_by_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
      `, [warehouseId, dto.locationId, dto.productId, delta, action, dto.reference?.trim() || null,
        dto.notes?.trim() || null, userId]);
      return { movement, quantityBefore: balance.quantity, quantityAfter: balance.quantity + delta };
    });
  }

  async transfer(warehouseId: number, dto: { fromLocationId: number; toLocationId: number; productId: number; quantity: number; notes?: string }, userId: number) {
    this.positiveId(warehouseId, 'warehouse');
    this.positiveId(dto?.fromLocationId, 'source location');
    this.positiveId(dto?.toLocationId, 'destination location');
    this.positiveId(dto?.productId, 'product');
    this.positiveId(userId, 'user');
    if (dto.fromLocationId === dto.toLocationId) throw new BadRequestException('Select different locations');
    if (!Number.isSafeInteger(dto.quantity) || dto.quantity < 1 || dto.quantity > 100000)
      throw new BadRequestException('Invalid transfer quantity');
    if ((dto.notes?.length || 0) > 2000) throw new BadRequestException('Notes too long');
    return this.db.transaction(async manager => {
      const locations = await manager.query(`
        SELECT l.id FROM warehouse_locations l JOIN warehouse_sites w ON w.id = l.warehouse_id
        WHERE l.id = ANY($1::int[]) AND l.warehouse_id = $2 AND l.is_active AND w.is_active
      `, [[dto.fromLocationId, dto.toLocationId], warehouseId]);
      if (locations.length !== 2) throw new NotFoundException('Active locations not found in this warehouse');
      if (!(await manager.query('SELECT id FROM products WHERE id = $1', [dto.productId])).length)
        throw new NotFoundException('Product not found');
      const sorted = [dto.fromLocationId, dto.toLocationId].sort((a, b) => a - b);
      for (const id of sorted) await manager.query(`
        INSERT INTO warehouse_stock (location_id, product_id, quantity) VALUES ($1,$2,0)
        ON CONFLICT (location_id, product_id) DO NOTHING
      `, [id, dto.productId]);
      const rows: Array<{ location_id: number; quantity: number }> = [];
      for (const id of sorted) rows.push((await manager.query(
        'SELECT location_id, quantity FROM warehouse_stock WHERE location_id = $1 AND product_id = $2 FOR UPDATE',
        [id, dto.productId],
      ))[0]);
      const source = rows.find(x => x.location_id === dto.fromLocationId);
      if (!source || source.quantity < dto.quantity) throw new BadRequestException('Insufficient stock for transfer');
      await manager.query(
        'UPDATE warehouse_stock SET quantity = quantity - $3 WHERE location_id = $1 AND product_id = $2',
        [dto.fromLocationId, dto.productId, dto.quantity],
      );
      await manager.query(
        'UPDATE warehouse_stock SET quantity = quantity + $3 WHERE location_id = $1 AND product_id = $2',
        [dto.toLocationId, dto.productId, dto.quantity],
      );
      const movementIds: string[] = [];
      for (const [id, change, type] of [
        [dto.fromLocationId, -dto.quantity, 'transfer_out'],
        [dto.toLocationId, dto.quantity, 'transfer_in'],
      ] as const) {
        const [movement] = await manager.query(`
          INSERT INTO warehouse_movements
            (warehouse_id, location_id, product_id, quantity_change, movement_type, notes, performed_by_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id::text
        `, [warehouseId, id, dto.productId, change, type, dto.notes?.trim() || null, userId]);
        movementIds.push(movement.id);
      }
      return { movementIds, quantityTransferred: dto.quantity };
    });
  }
}
