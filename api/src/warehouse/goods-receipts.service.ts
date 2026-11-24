import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

type ReceiptInput = {
  warehouseId: number; locationId: number; requestKey: string;
  supplierReference?: string; notes?: string;
  lines: { poLineId: number; quantity: number }[];
};
type OrderLine = { poLineId: number; productId: number | null; articleNumber: string; description: string; ordered: number; received: number; remaining: number };

@Injectable()
export class GoodsReceiptsService {
  constructor(private readonly db: DataSource) {}

  private async lines(manager: EntityManager, poId: number): Promise<OrderLine[]> {
    const rows: Omit<OrderLine, 'remaining'>[] = await manager.query(`
      SELECT l.id AS "poLineId", l.product_id AS "productId", l.article_number AS "articleNumber",
        l.description, l.quantity AS ordered,
        COALESCE((SELECT SUM(r.quantity) FROM warehouse_goods_receipt_lines r WHERE r.po_line_id = l.id),0)::int AS received
      FROM po_line_items l WHERE l.po_id = $1 ORDER BY l.id
    `, [poId]);
    return rows.map(r => ({ ...r, remaining: r.ordered - r.received }));
  }

  async overview(poId: number) {
    return this.db.transaction('REPEATABLE READ', async manager => {
      const [po] = await manager.query('SELECT id, status FROM purchase_orders WHERE id = $1', [poId]);
      if (!po) throw new NotFoundException('Purchase order not found');
      const lines = await this.lines(manager, poId);
      const receipts = await manager.query(`
        SELECT r.id, 'GR-' || LPAD(r.id::text, GREATEST(6, LENGTH(r.id::text)), '0') AS "receiptNumber",
          w.name AS "warehouseName", l.code AS "locationCode", r.created_at AS "createdAt",
          r.supplier_reference AS "supplierReference", r.notes, r.performed_by_id AS "performedById",
          (SELECT SUM(x.quantity)::int FROM warehouse_goods_receipt_lines x WHERE x.receipt_id = r.id) AS quantity
        FROM warehouse_goods_receipts r JOIN warehouse_sites w ON w.id = r.warehouse_id
        JOIN warehouse_locations l ON l.id = r.location_id WHERE r.po_id = $1 ORDER BY r.id DESC
      `, [poId]);
      return { status: po.status, lines, receipts,
        legacyReceived: po.status === 'received' && receipts.length === 0,
        canReceive: ['sent','confirmed','shipped'].includes(po.status) && lines.some(l => l.remaining > 0) };
    });
  }

  async receive(poId: number, dto: ReceiptInput, userId: number) {
    const positive = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n > 0 && n <= 2147483647;
    if (!positive(poId) || !positive(userId) || !positive(dto?.warehouseId) || !positive(dto?.locationId) ||
        typeof dto?.requestKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dto.requestKey) ||
        !Array.isArray(dto.lines) || !dto.lines.length || dto.lines.length > 100 ||
        dto.lines.some(l => !positive(l?.poLineId) || !positive(l?.quantity) || l.quantity > 100000) ||
        new Set(dto.lines.map(l => l.poLineId)).size !== dto.lines.length ||
        (dto.notes !== undefined && (typeof dto.notes !== 'string' || dto.notes.length > 2000)) ||
        (dto.supplierReference !== undefined && (typeof dto.supplierReference !== 'string' || dto.supplierReference.length > 160)))
      throw new BadRequestException('Invalid goods receipt details');
    return this.db.transaction(async manager => {
      const [po] = await manager.query('SELECT id, status FROM purchase_orders WHERE id = $1 FOR UPDATE', [poId]);
      if (!po) throw new NotFoundException('Purchase order not found');
      const [existing] = await manager.query('SELECT * FROM warehouse_goods_receipts WHERE request_key = $1', [dto.requestKey]);
      const notes = dto.notes?.trim() || null, reference = dto.supplierReference?.trim() || null;
      if (existing) {
        const old: Array<{ poLineId: number; quantity: number }> = await manager.query(
          'SELECT po_line_id AS "poLineId", quantity FROM warehouse_goods_receipt_lines WHERE receipt_id = $1 ORDER BY po_line_id', [existing.id]);
        const current = [...dto.lines].sort((a,b) => a.poLineId-b.poLineId);
        if (existing.po_id !== poId || existing.warehouse_id !== dto.warehouseId || existing.location_id !== dto.locationId ||
            existing.supplier_reference !== reference || existing.notes !== notes || old.length !== current.length ||
            old.some((l,i) => l.poLineId !== current[i].poLineId || l.quantity !== current[i].quantity))
          throw new ConflictException('Request key already used for different receipt details');
        return { id: existing.id, duplicate: true, status: po.status };
      }
      if (!['sent','confirmed','shipped'].includes(po.status)) throw new BadRequestException('Order is not eligible for receiving');
      const [location] = await manager.query(`
        SELECT l.id FROM warehouse_locations l JOIN warehouse_sites w ON w.id = l.warehouse_id
        WHERE l.id = $1 AND w.id = $2 AND l.is_active AND w.is_active
      `, [dto.locationId, dto.warehouseId]);
      if (!location) throw new BadRequestException('Select an active warehouse location');
      const lines = await this.lines(manager, poId);
      const selected = dto.lines.map(input => {
        const line = lines.find(l => l.poLineId === input.poLineId);
        if (!line || !line.productId || input.quantity > line.remaining)
          throw new BadRequestException('Invalid product line or quantity exceeds remaining order quantity');
        return { ...input, productId: line.productId };
      }).sort((a,b) => a.productId-b.productId || a.poLineId-b.poLineId);
      const [receipt] = await manager.query(`
        INSERT INTO warehouse_goods_receipts (po_id,warehouse_id,location_id,request_key,supplier_reference,notes,performed_by_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id
      `, [poId,dto.warehouseId,dto.locationId,dto.requestKey,reference,notes,userId]);
      const receiptNumber = 'GR-' + String(receipt.id).padStart(6,'0');
      for (const line of selected) {
        await manager.query('INSERT INTO warehouse_goods_receipt_lines (receipt_id,po_line_id,product_id,quantity) VALUES ($1,$2,$3,$4)',
          [receipt.id,line.poLineId,line.productId,line.quantity]);
        await manager.query(`
          INSERT INTO warehouse_stock (location_id,product_id,quantity) VALUES ($1,$2,$3)
          ON CONFLICT (location_id,product_id) DO UPDATE SET quantity = warehouse_stock.quantity + EXCLUDED.quantity
        `, [dto.locationId,line.productId,line.quantity]);
        await manager.query(`
          INSERT INTO warehouse_movements (warehouse_id,location_id,product_id,quantity_change,movement_type,reference,notes,performed_by_id)
          VALUES ($1,$2,$3,$4,'receipt',$5,$6,$7)
        `, [dto.warehouseId,dto.locationId,line.productId,line.quantity,receiptNumber,notes,userId]);
      }
      const updated = await this.lines(manager, poId);
      const complete = updated.length > 0 && updated.every(l => l.remaining === 0);
      if (complete) await manager.query("UPDATE purchase_orders SET status = 'received', updated_at = NOW() WHERE id = $1", [poId]);
      return { id: receipt.id, receiptNumber, duplicate: false, status: complete ? 'received' : po.status };
    });
  }
}
