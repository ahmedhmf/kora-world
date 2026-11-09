import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../accounts/entities/account.entity';
import { DeliveryNote } from './delivery-note.entity';
import { WeeklySalesReport } from './weekly-sales-report.entity';
import { InventoryAdjustment } from './inventory-adjustment.entity';

export type MovementKind = 'delivery' | 'sale' | 'cancellation' | 'adjustment';
export interface StockMovement {
  id: string;
  productId: number;
  articleNumber: string;
  productName: string;
  type: MovementKind;
  timestamp: string;
  documentDate: string | null;
  reference: string;
  sourceId: number;
  quantityChange: number;
  balanceBefore: number;
  balanceAfter: number;
  performedBy: string | null;
  reason: string | null;
  notes: string | null;
  timestampEstimated: boolean;
}

@Injectable()
export class InventoryLedgerService {
  constructor(
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(DeliveryNote) private readonly notes: Repository<DeliveryNote>,
    @InjectRepository(WeeklySalesReport) private readonly sales: Repository<WeeklySalesReport>,
    @InjectRepository(InventoryAdjustment) private readonly adjustments: Repository<InventoryAdjustment>,
  ) {}

  async getLedger(accountId: number, filters: {
    productId?: string; type?: string; from?: string; to?: string;
  } = {}) {
    if (!await this.accounts.exists({ where: { id: accountId } })) throw new NotFoundException('Account not found');
    const productId = filters.productId ? Number(filters.productId) : null;
    if (productId !== null && (!Number.isSafeInteger(productId) || productId <= 0)) throw new BadRequestException('Invalid product filter');
    const kinds: MovementKind[] = ['delivery', 'sale', 'cancellation', 'adjustment'];
    if (filters.type && !kinds.includes(filters.type as MovementKind)) throw new BadRequestException('Invalid movement type');
    const validDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
    if ((filters.from && !validDate(filters.from)) || (filters.to && !validDate(filters.to)) ||
      (filters.from && filters.to && filters.from > filters.to)) throw new BadRequestException('Invalid date range');

    type Raw = Omit<StockMovement, 'balanceBefore' | 'balanceAfter'>;
    const raw: Raw[] = [];
    const notes = await this.notes.createQueryBuilder('n').where('n.accountId = :accountId', { accountId })
      .andWhere('n.signedFilePath IS NOT NULL').getMany();
    for (const note of notes) for (const item of note.items) {
      raw.push({
        id: `delivery-${note.id}-${item.productId}`, productId: item.productId,
        articleNumber: item.articleNumber, productName: item.productName,
        type: 'delivery', timestamp: new Date(note.createdAt).toISOString(),
        documentDate: note.deliveryDate, reference: note.noteNumber, sourceId: note.id,
        quantityChange: item.quantity, performedBy: null, reason: 'Signed delivery',
        notes: note.remarks || null, timestampEstimated: true,
      });
    }
    const reports = await this.sales.find({ where: { accountId } });
    for (const report of reports) {
      if (!report.approvedAt) continue;
      for (const item of report.items) {
        raw.push({
          id: `sale-${report.id}-${item.productId}`, productId: item.productId,
          articleNumber: item.articleNumber, productName: item.productName,
          type: 'sale', timestamp: new Date(report.approvedAt).toISOString(),
          documentDate: report.weekEnd, reference: `Sales #${report.id}`, sourceId: report.id,
          quantityChange: -item.quantity, performedBy: report.approvedByName || null,
          reason: 'Weekly sales approved', notes: report.remarks || null, timestampEstimated: false,
        });
        if (report.status === 'cancelled' && report.cancelledAt) {
          raw.push({
            id: `cancellation-${report.id}-${item.productId}`, productId: item.productId,
            articleNumber: item.articleNumber, productName: item.productName,
            type: 'cancellation', timestamp: new Date(report.cancelledAt).toISOString(),
            documentDate: null, reference: `Sales #${report.id}`, sourceId: report.id,
            quantityChange: item.quantity, performedBy: report.cancelledByName || null,
            reason: report.cancellationReason || 'Sales report cancelled',
            notes: null, timestampEstimated: false,
          });
        }
      }
    }
    const adjustments = await this.adjustments.find({ where: { accountId } });
    for (const adj of adjustments) raw.push({
      id: `adjustment-${adj.id}`, productId: adj.productId,
      articleNumber: adj.articleNumber, productName: adj.productName,
      type: 'adjustment', timestamp: new Date(adj.createdAt).toISOString(),
      documentDate: null, reference: `Correction #${adj.id}`, sourceId: adj.id,
      quantityChange: adj.quantity, performedBy: adj.createdByName || null,
      reason: adj.reason, notes: adj.notes, timestampEstimated: false,
    });
    // Compute balances over the complete unfiltered history so date/type filters do not
    // reset the running balance. Stable IDs break timestamp ties deterministically.
    raw.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
    const balances = new Map<number, number>();
    const all: StockMovement[] = raw.map(m => {
      const before = balances.get(m.productId) || 0;
      const after = before + m.quantityChange;
      balances.set(m.productId, after);
      return { ...m, balanceBefore: before, balanceAfter: after };
    });
    const movements = all.filter(m =>
      (productId === null || m.productId === productId) &&
      (!filters.type || m.type === filters.type) &&
      (!filters.from || m.timestamp.slice(0, 10) >= filters.from) &&
      (!filters.to || m.timestamp.slice(0, 10) <= filters.to)
    ).reverse();
    const currentBalances = [...balances].map(([id, quantity]) => ({ productId: id, quantity }));
    return {
      movements, total: movements.length, currentBalances,
      timestampNotice: 'For existing signed delivery notes, the recorded creation time is used as an approximate movement timestamp; the original delivery date is shown separately. Historical signing times were not recorded.',
    };
  }
}
