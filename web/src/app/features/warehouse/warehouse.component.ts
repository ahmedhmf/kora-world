import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, firstValueFrom, forkJoin } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { Product } from '../../core/models/product.model';
import { WarehouseSite, WarehouseLocation, WarehouseStock, WarehouseMovement, WarehouseAction } from '../../core/models/warehouse.model';

@Component({
  selector: 'app-warehouse',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './warehouse.component.html',
})
export class WarehouseComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly sites = signal<WarehouseSite[]>([]);
  readonly locations = signal<WarehouseLocation[]>([]);
  readonly products = signal<Product[]>([]);
  readonly stock = signal<WarehouseStock[]>([]);
  readonly movements = signal<WarehouseMovement[]>([]);
  readonly selectedId = signal(0);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly search = signal('');
  readonly locationFilter = signal(0);
  readonly tab = signal<'stock' | 'movements' | 'locations' | 'report'>('stock');
  readonly report = signal<{stock:{kind:string;itemId:number;code:string;name:string;locationCode:string;physical:number;reservedPeak:number;dispatched:number}[];events:{eventId:number;title:string;status:string;name:string;quantity:number;startsAt:string;endsAt:string;returned:number|null;damaged:number|null;missing:number|null;consumed:number|null;notes:string|null}[]} | null>(null);
  async loadReport(){this.tab.set('report');this.report.set(null);try{this.report.set(await firstValueFrom(this.api.getWarehouseReport(this.selectedId())));}catch(e){this.error.set(this.message(e));}}
  exportReport(){const data=this.report();if(!data)return;const quote=(value:unknown)=>{let s=String(value??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};const rows=[['Type','Code','Item','Location','Physical','Peak reserved','Dispatched','Uncommitted'],...data.stock.map(r=>[r.kind,r.code,r.name,r.locationCode,r.physical,r.reservedPeak,r.dispatched,Math.max(0,r.physical-r.reservedPeak)]),[],['Event','Title','Status','Item','Quantity','Starts','Ends','Returned','Damaged','Missing','Consumed','Notes'],...data.events.map(r=>[r.eventId,r.title,r.status,r.name,r.quantity,r.startsAt,r.endsAt,r.returned,r.damaged,r.missing,r.consumed,r.notes])];const url=URL.createObjectURL(new Blob([rows.map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='warehouse-'+this.selectedId()+'-report.csv';a.click();URL.revokeObjectURL(url);}

  readonly selected = computed(() => this.sites().find(s => s.id === this.selectedId()));
  readonly total = computed(() => this.stock().reduce((sum, row) => sum + row.quantity, 0));
  readonly productCount = computed(() => new Set(this.stock().filter(r => r.quantity > 0).map(r => r.productId)).size);
  readonly visibleStock = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.stock().filter(r => (!this.locationFilter() || r.locationId === this.locationFilter()) &&
      (!q || [r.articleNumber, r.productName, r.locationCode].some(v => v.toLowerCase().includes(q))));
  });
  readonly actions: { value: WarehouseAction; label: string }[] = [
    { value: 'receipts', label: 'Receive stock' }, { value: 'issues', label: 'Issue stock' },
    { value: 'returns', label: 'Return stock' }, { value: 'adjustments', label: 'Adjust stock' },
    { value: 'transfers', label: 'Transfer stock' },
  ];
  siteForm = { code: '', name: '', address: '' };
  locationForm = { code: '', name: '' };
  operation: WarehouseAction = 'receipts';
  movement = { locationId: 0, toLocationId: 0, productId: 0, quantity: 1, reference: '', notes: '' };

  ngOnInit(): void { void this.refresh(); }

  private message(err: unknown): string {
    const value = (err as { error?: { message?: unknown }; message?: string })?.error?.message;
    return Array.isArray(value) ? value.join('; ') : typeof value === 'string' ? value : 'Request failed. Check the API connection and permissions.';
  }
  private async loadSite(id: number): Promise<void> {
    this.selectedId.set(id);
    this.report.set(null); if(this.tab()==='report') this.tab.set('stock');
    this.locations.set([]); this.stock.set([]); this.movements.set([]);
    this.locationFilter.set(0);
    this.movement.locationId = 0; this.movement.toLocationId = 0;
    if (!id) return;
    const result = await firstValueFrom(forkJoin({
      locations: this.api.getWarehouseLocations(id), stock: this.api.getWarehouseStock(id),
      movements: this.api.getWarehouseMovements(id),
    }));
    this.locations.set(result.locations); this.stock.set(result.stock); this.movements.set(result.movements);
  }
  async refresh(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      const result = await firstValueFrom(forkJoin({ sites: this.api.getWarehouses(), products: this.api.getProducts() }));
      this.sites.set(result.sites); this.products.set(result.products);
      const id = result.sites.some(s => s.id === this.selectedId()) ? this.selectedId() : (result.sites[0]?.id ?? 0);
      await this.loadSite(id);
    } catch (err) { this.error.set(this.message(err)); }
    finally { this.busy.set(false); }
  }
  async selectSite(id: number): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.success.set('');
    try { await this.loadSite(id); } catch (err) { this.error.set(this.message(err)); }
    finally { this.busy.set(false); }
  }
  private async submit(request: Observable<unknown>, onSaved: (result: unknown) => Promise<void>, label: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.success.set('');
    try {
      const result = await firstValueFrom(request);
      this.success.set(label);
      try { await onSaved(result); }
      catch (err) { this.error.set('Saved successfully, but refreshing failed. Refresh before making another change. ' + this.message(err)); }
    } catch (err) { this.error.set(this.message(err)); }
    finally { this.busy.set(false); }
  }
  createSite(): void {
    if (!this.siteForm.code.trim() || !this.siteForm.name.trim()) { this.error.set('Enter a warehouse code and name.'); return; }
    void this.submit(this.api.createWarehouse({ ...this.siteForm }), async result => {
      this.siteForm = { code: '', name: '', address: '' };
      this.sites.set(await firstValueFrom(this.api.getWarehouses()));
      await this.loadSite((result as WarehouseSite).id);
    }, 'Warehouse created.');
  }
  createLocation(): void {
    if (!this.selected()?.is_active || !this.locationForm.code.trim() || !this.locationForm.name.trim()) {
      this.error.set('Select an active warehouse and enter a location code and name.'); return;
    }
    const id = this.selectedId();
    void this.submit(this.api.createWarehouseLocation(id, { ...this.locationForm }), async () => {
      this.locationForm = { code: '', name: '' }; await this.loadSite(id);
    }, 'Storage location created.');
  }
  record(): void {
    const m = { ...this.movement };
    const id = this.selectedId();
    if (!this.selected()?.is_active || !this.locations().some(l => l.id === m.locationId && l.is_active) ||
      !this.products().some(p => p.id === m.productId) || !Number.isSafeInteger(m.quantity) ||
      !m.quantity || Math.abs(m.quantity) > 100000 || (this.operation !== 'adjustments' && m.quantity < 1)) {
      this.error.set('Select a product, active location and valid whole-number quantity.'); return;
    }
    if (this.operation === 'adjustments' && !m.notes.trim()) { this.error.set('Enter a reason for the adjustment.'); return; }
    if (this.operation === 'transfers' && (m.toLocationId === m.locationId || !this.locations().some(l => l.id === m.toLocationId && l.is_active))) {
      this.error.set('Select a different active destination location.'); return;
    }
    const request = this.operation === 'transfers'
      ? this.api.transferWarehouseStock(id, { fromLocationId: m.locationId, toLocationId: m.toLocationId, productId: m.productId, quantity: m.quantity, notes: m.notes })
      : this.api.recordWarehouseMovement(id, this.operation, { locationId: m.locationId, productId: m.productId, quantity: m.quantity, reference: m.reference, notes: m.notes });
    void this.submit(request, async () => {
      this.movement = { ...m, quantity: 1, reference: '', notes: '' };
      await this.loadSite(id);
    }, 'Stock movement recorded.');
  }
  productLabel(id: number): string {
    const p = this.products().find(p => p.id === id);
    return p ? p.articleNumber + ' — ' + p.name : 'Product #' + id;
  }
  locationLabel(id: number): string { return this.locations().find(l => l.id === id)?.code ?? '#' + id; }
}
