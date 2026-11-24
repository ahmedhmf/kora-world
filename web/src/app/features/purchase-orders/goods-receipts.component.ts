import { Component, Input, OnInit, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { WarehouseSite, WarehouseLocation } from '../../core/models/warehouse.model';

@Component({
  selector: 'app-goods-receipts', standalone: true, imports: [CommonModule, FormsModule],
  templateUrl: './goods-receipts.component.html',
})
export class GoodsReceiptsComponent implements OnInit {
  @Input({ required: true }) poId!: number;
  readonly posted = output<void>();
  private api = inject(ApiService);
  readonly data = signal<{
    status: string; legacyReceived: boolean; canReceive: boolean;
    lines: { poLineId: number; productId: number | null; articleNumber: string; description: string; ordered: number; received: number; remaining: number }[];
    receipts: { id: number; receiptNumber: string; warehouseName: string; locationCode: string; createdAt: string; supplierReference: string | null; quantity: number }[];
  } | null>(null);
  readonly sites = signal<WarehouseSite[]>([]);
  readonly locations = signal<WarehouseLocation[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  warehouseId = 0; locationId = 0; reference = ''; notes = '';
  quantities: Record<number, number> = {};
  private pending: { key: string; fingerprint: string } | null = null;

  ngOnInit() { void this.refresh(); }
  private message(e: any): string { return Array.isArray(e?.error?.message) ? e.error.message.join('; ') : e?.error?.message || 'Request failed. Check the API connection.'; }
  async refresh() {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      const result = await firstValueFrom(forkJoin({ data: this.api.getGoodsReceipts(this.poId), sites: this.api.getWarehouses() }));
      this.data.set(result.data); this.sites.set(result.sites.filter(s => s.is_active));
    } catch (e) { this.error.set(this.message(e)); }
    finally { this.busy.set(false); }
  }
  async selectWarehouse(id: number) {
    if (this.busy()) return;
    this.warehouseId = id; this.locationId = 0; this.locations.set([]);
    if (!id) return;
    this.busy.set(true);
    try { this.locations.set((await firstValueFrom(this.api.getWarehouseLocations(id))).filter(l => l.is_active)); }
    catch (e) { this.error.set(this.message(e)); }
    finally { this.busy.set(false); }
  }
  fillRemaining() { for (const l of this.data()?.lines ?? []) this.quantities[l.poLineId] = l.productId ? Math.min(100000, l.remaining) : 0; }
  async receive() {
    if (this.busy() || !this.data()?.canReceive) return;
    this.error.set(''); this.success.set('');
    const source = this.data()!.lines;
    const lines = source.map(l => ({ poLineId: l.poLineId, quantity: this.quantities[l.poLineId] ?? 0 })).filter(l => l.quantity !== 0);
    if (!this.warehouseId || !this.locationId || !lines.length || lines.some(l => !Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 100000 || l.quantity > source.find(s => s.poLineId === l.poLineId)!.remaining)) {
      this.error.set('Select a warehouse, location and valid quantities within the remaining order.'); return;
    }
    const dto = { warehouseId: this.warehouseId, locationId: this.locationId, supplierReference: this.reference, notes: this.notes, lines };
    const fingerprint = JSON.stringify(dto);
    if (this.pending && this.pending.fingerprint !== fingerprint) {
      this.error.set('Previous request outcome is uncertain. Retry the original quantities or reload and check receipt history before creating another receipt.'); return;
    }
    this.pending ??= { key: crypto.randomUUID(), fingerprint };
    this.busy.set(true);
    try {
      const r = await firstValueFrom(this.api.receivePurchaseOrder(this.poId, { ...dto, requestKey: this.pending.key }));
      this.pending = null; this.quantities = {}; this.reference = ''; this.notes = '';
      this.success.set('Goods receipt #' + r.id + ' recorded. Warehouse stock updated.');
      try { this.data.set(await firstValueFrom(this.api.getGoodsReceipts(this.poId))); }
      catch { this.error.set('Receipt saved, but refreshing failed. Reload before receiving again.'); this.data.set(null); }
      this.posted.emit();
    } catch (e: any) {
      if (e?.status >= 400 && e.status < 500 && e.status !== 409) this.pending = null;
      this.error.set(this.message(e));
    } finally { this.busy.set(false); }
  }
}
