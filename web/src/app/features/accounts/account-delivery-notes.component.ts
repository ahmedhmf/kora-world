import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { B2BAccount } from '../../core/models/account.model';
import { WarehouseSite, WarehouseLocation, WarehouseStock } from '../../core/models/warehouse.model';
import { forkJoin } from 'rxjs';
import { Product } from '../../core/models/product.model';

interface DeliveryItem { productId: number; quantity: number; }
interface DeliveryNote {
  id: number; noteNumber: string; deliveryDate: string; customerName: string;
  deliveryAddress?: string; paymentModel?: string; remarks?: string;
  items: Array<{ articleNumber: string; productName: string; quantity: number }>;
  signedFilePath?: string; signedFileName?: string;
  deliverySource?: 'legacy' | 'warehouse' | 'supplier' | 'external'; sourceDetails?: string; warehouseId?: number; locationId?: number; dispatchedAt?: string;
}

@Component({
  selector: 'app-account-delivery-notes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="p-8 max-w-5xl mx-auto space-y-6">
      <a [routerLink]="['/accounts', accountId]" class="text-zinc-400 hover:text-white text-sm">← Back to Account</a>
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Delivery Notes</h1>
          <p class="text-zinc-400 text-sm">{{ account()?.companyName }}</p>
        </div>
      </div>
      @if (error()) { <p class="bg-red-900/30 border border-red-800 text-red-300 rounded-lg p-3">{{ error() }}</p> }
      @if (success()) { <p class="bg-emerald-900/30 border border-emerald-800 text-emerald-300 rounded-lg p-3">{{ success() }}</p> }
      <section class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 space-y-4">
        <h2 class="font-semibold text-white">Create Delivery Note</h2>
        <div>
          <label class="block text-sm text-zinc-400 mb-1">Delivery Date</label>
          <input type="date" [(ngModel)]="deliveryDate" class="bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-white" />
        </div>
        <label class="block text-sm text-zinc-400">Delivery source
          <select [ngModel]="deliverySource" (ngModelChange)="changeSource($event)" [disabled]="saving()" class="block bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-white">
            <option value="warehouse">KORA Warehouse</option><option value="supplier">Direct supplier delivery</option><option value="external">External stock</option>
          </select>
        </label>
        @if (deliverySource === 'warehouse') {
          <div class="grid sm:grid-cols-2 gap-3">
            <label class="text-sm text-zinc-400">Warehouse<select [ngModel]="warehouseId" (ngModelChange)="selectWarehouse($event)" [disabled]="saving()" class="block w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-white"><option [ngValue]="0">Select warehouse</option>@for (w of warehouses(); track w.id) { <option [ngValue]="w.id">{{ w.name }}</option> }</select></label>
            <label class="text-sm text-zinc-400">Location<select [ngModel]="locationId" (ngModelChange)="selectLocation($event)" [disabled]="saving() || loadingStock()" class="block w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-white"><option [ngValue]="0">Select location</option>@for (l of locations(); track l.id) { <option [ngValue]="l.id">{{ l.code }} — {{ l.name }}</option> }</select></label>
          </div>
          <p class="text-xs text-zinc-400">Stock is checked now and deducted only when dispatch is confirmed. Stock is not reserved.</p>
        } @else {
          <label class="block text-sm text-zinc-400">{{ deliverySource === 'supplier' ? 'Supplier name / shipment reference' : 'External stock source / reason' }}
            <input [(ngModel)]="sourceDetails" maxlength="200" class="block w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-white">
          </label>
          <p class="text-xs text-zinc-400">No KORA warehouse stock will be deducted.</p>
        }
        <h3 class="text-sm font-semibold text-zinc-300">Products delivered</h3>
        @for (item of items; track $index; let i = $index) {
          <div class="flex gap-3 items-center flex-wrap">
            <select [(ngModel)]="item.productId" class="bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-white flex-1 min-w-48">
              <option [ngValue]="0">Select product...</option>
              @for (product of availableProducts(); track product.id) {
                <option [ngValue]="product.id">{{ product.articleNumber }} — {{ product.name }}{{ deliverySource === 'warehouse' ? ' (' + available(product.id) + ' available)' : '' }}</option>
              }
            </select>
            <input type="number" min="1" step="1" [(ngModel)]="item.quantity" aria-label="Quantity" class="w-24 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-white" />
            <button type="button" (click)="removeItem(i)" class="text-red-400 text-sm">Remove</button>
          </div>
        }
        <button type="button" (click)="addItem()" class="text-sm text-blue-400">+ Add product</button>
        <div>
          <label class="block text-sm text-zinc-400 mb-1">Delivery Remarks (optional)</label>
          <textarea [(ngModel)]="remarks" maxlength="2000" rows="2" class="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-white"></textarea>
        </div>
        <button type="button" [disabled]="saving() || loadingStock()" (click)="create()" class="bg-white text-zinc-900 font-semibold rounded-lg px-4 py-2 disabled:opacity-50">Save Delivery Note</button>
      </section>

      <section class="space-y-3">
        <h2 class="font-semibold text-white">Saved Delivery Notes</h2>
        @for (note of notes(); track note.id) {
          <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-white font-semibold">{{ note.noteNumber }}</p>
              <p class="text-zinc-400 text-sm">{{ note.deliveryDate }} · {{ note.items.length }} product lines</p>
              <p class="text-xs text-zinc-400">{{ sourceLabel(note) }}</p>
              @if (note.deliverySource === 'warehouse' && !note.signedFilePath) { <p class="text-xs text-amber-400">{{ note.dispatchedAt ? 'Dispatched — awaiting signature' : 'Prepared — awaiting dispatch' }}</p> }
              <p class="text-xs" [class.text-emerald-400]="note.signedFilePath" [class.text-amber-400]="!note.signedFilePath">
                {{ note.signedFilePath ? 'Signed copy uploaded' : 'Awaiting signed copy' }}
              </p>
            </div>
            <div class="flex items-center gap-3 flex-wrap">
              <button type="button" (click)="print(note)" class="bg-zinc-700 text-white px-3 py-2 rounded-lg text-sm">Download Official PDF</button>
              @if (note.signedFilePath) {
                <button type="button" (click)="downloadSigned(note)" class="text-blue-400 text-sm">View signed copy</button>
              }
              @if (note.deliverySource && note.deliverySource !== 'legacy' && !note.dispatchedAt && !note.signedFilePath) {
                <button type="button" (click)="dispatch(note)" [disabled]="saving()" class="bg-white text-zinc-900 rounded-lg px-3 py-2 text-sm">Confirm dispatch</button>
              }
              @if (note.deliverySource !== 'warehouse' || note.dispatchedAt) {
              <label class="cursor-pointer bg-zinc-800 text-white px-3 py-2 rounded-lg text-sm">
                Upload signed copy
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" class="hidden" (change)="uploadSigned(note, $event)" />
              </label>
              }
            </div>
          </div>
        } @empty {
          <p class="text-zinc-500 text-sm">No delivery notes yet.</p>
        }
      </section>
    </div>
  `,
})
export class AccountDeliveryNotesComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  accountId = 0;
  account = signal<B2BAccount | null>(null);
  products = signal<Product[]>([]);
  notes = signal<DeliveryNote[]>([]);
  error = signal('');
  success = signal('');
  saving = signal(false);
  deliveryDate = new Date().toLocaleDateString('en-CA');
  remarks = '';
  deliverySource: 'warehouse' | 'supplier' | 'external' = 'warehouse';
  warehouseId = 0; locationId = 0; sourceDetails = '';
  warehouses = signal<WarehouseSite[]>([]);
  locations = signal<WarehouseLocation[]>([]);
  warehouseStock = signal<WarehouseStock[]>([]);
  loadingStock = signal(false);
  items: DeliveryItem[] = [{ productId: 0, quantity: 1 }];

  ngOnInit(): void {
    this.accountId = Number(this.route.snapshot.paramMap.get('id'));
    this.api.getAccount(this.accountId).subscribe({ next: a => this.account.set(a), error: () => this.error.set('Could not load account') });
    this.api.getProducts().subscribe({ next: p => this.products.set(p), error: () => this.error.set('Could not load products') });
    this.api.getWarehouses().subscribe({ next: w => this.warehouses.set(w.filter(s => s.is_active)), error: () => this.error.set('Could not load warehouses') });
    this.reload();
  }
  changeSource(source: 'warehouse' | 'supplier' | 'external'): void {
    this.deliverySource = source; this.sourceDetails = ''; this.items = [{ productId: 0, quantity: 1 }];
  }
  selectWarehouse(id: number): void {
    this.warehouseId = id; this.locationId = 0; this.locations.set([]); this.warehouseStock.set([]);
    this.items = [{ productId: 0, quantity: 1 }];
    if (!id) { this.loadingStock.set(false); return; }
    this.loadingStock.set(true);
    forkJoin({ locations: this.api.getWarehouseLocations(id), stock: this.api.getWarehouseStock(id) }).subscribe({
      next: result => { if (this.warehouseId !== id) return; this.locations.set(result.locations.filter(l => l.is_active)); this.warehouseStock.set(result.stock); this.loadingStock.set(false); },
      error: () => { if (this.warehouseId === id) { this.loadingStock.set(false); this.error.set('Could not load warehouse stock'); } },
    });
  }
  selectLocation(id: number): void { this.locationId = id; this.items = [{ productId: 0, quantity: 1 }]; }
  available(id: number): number { return this.warehouseStock().find(s => s.locationId === this.locationId && s.productId === id)?.quantity ?? 0; }
  availableProducts(): Product[] { return this.deliverySource === 'warehouse' ? this.products().filter(p => this.available(p.id) > 0) : this.products(); }
  sourceLabel(note: DeliveryNote): string {
    if (note.deliverySource === 'warehouse') return 'Warehouse #' + note.warehouseId + ' / Location #' + note.locationId;
    if (note.deliverySource === 'supplier') return 'Direct supplier: ' + note.sourceDetails;
    if (note.deliverySource === 'external') return 'External stock: ' + note.sourceDetails;
    return 'Legacy delivery (not warehouse tracked)';
  }
  dispatch(note: DeliveryNote): void {
    if (this.saving() || !window.confirm('Confirm goods have physically left the source? Warehouse stock will be deducted for warehouse deliveries.')) return;
    this.saving.set(true); this.error.set(''); this.success.set('');
    this.api.dispatchDeliveryNote(note.id).subscribe({
      next: () => { this.saving.set(false); this.success.set(note.noteNumber + ' dispatched.'); this.reload(); if (this.warehouseId) this.api.getWarehouseStock(this.warehouseId).subscribe({ next: s => this.warehouseStock.set(s), error: () => this.error.set('Dispatch saved; refresh stock before creating another note.') }); },
      error: err => { this.saving.set(false); this.error.set(err.error?.message || 'Could not dispatch delivery'); },
    });
  }
  reload(): void {
    this.api.getDeliveryNotes(this.accountId).subscribe({ next: n => this.notes.set(n), error: () => this.error.set('Could not load delivery notes') });
  }
  addItem(): void { this.items.push({ productId: 0, quantity: 1 }); }
  removeItem(index: number): void { this.items.splice(index, 1); }
  create(): void {
    this.error.set(''); this.success.set('');
    if (!this.deliveryDate || !this.items.length || this.items.some(i => !i.productId || !Number.isInteger(Number(i.quantity)) || Number(i.quantity) < 1) || new Set(this.items.map(i => i.productId)).size !== this.items.length) {
      this.error.set('Select unique products and positive whole-number quantities.'); return;
    }
    if (this.deliverySource === 'warehouse' && (!this.warehouseId || !this.locationId || this.items.some(i => i.quantity > this.available(i.productId)))) {
      this.error.set('Select a warehouse location with sufficient stock.'); return;
    }
    if (this.deliverySource !== 'warehouse' && !this.sourceDetails.trim()) { this.error.set('Specify the delivery source.'); return; }
    this.saving.set(true);
    this.api.createDeliveryNote(this.accountId, { deliveryDate: this.deliveryDate, remarks: this.remarks, deliverySource: this.deliverySource, warehouseId: this.warehouseId, locationId: this.locationId, sourceDetails: this.sourceDetails, items: this.items.map(i => ({ productId: Number(i.productId), quantity: Number(i.quantity) })) }).subscribe({
      next: note => { this.saving.set(false); this.items = [{ productId: 0, quantity: 1 }]; this.remarks = ''; this.success.set(note.noteNumber + ' saved. Confirm dispatch when goods leave, then obtain customer signature.'); this.reload(); },
      error: err => { this.saving.set(false); this.error.set(err.error?.message || 'Could not create delivery note'); },
    });
  }
  async print(note: DeliveryNote): Promise<void> {
    this.error.set('');
    try {
      const response = await fetch('/assets/kora-stationery.pdf');
      if (!response.ok) throw new Error('Official stationery PDF missing from web/public/assets/kora-stationery.pdf');
      const template = await PDFDocument.load(await response.arrayBuffer());
      const output = await PDFDocument.create();
      const regular = await output.embedFont(StandardFonts.Helvetica);
      const bold = await output.embedFont(StandardFonts.HelveticaBold);
      const black = rgb(0.10, 0.10, 0.10);
      const gray = rgb(0.42, 0.42, 0.42);
      const left = 76, right = 516;
      const safe = (value: unknown) => String(value ?? '').replace(/[^\x20-\x7E]/g, c => c === '–' ? '-' : c === '—' ? '-' : '?');
      const text = (page: PDFPage, value: unknown, x: number, y: number, size = 10, font: PDFFont = regular) =>
        page.drawText(safe(value), { x, y, size, font, color: black });
      const wrapped = (value: unknown, font: PDFFont, size: number, width: number): string[] => {
        const words = safe(value).split(/\s+/).filter(Boolean);
        const lines: string[] = [];
        let line = '';
        for (const word of words) {
          const candidate = line ? line + ' ' + word : word;
          if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue; }
          if (line) { lines.push(line); line = ''; }
          let chunk = '';
          for (const char of word) {
            if (font.widthOfTextAtSize(chunk + char, size) > width && chunk) { lines.push(chunk); chunk = ''; }
            chunk += char;
          }
          line = chunk;
        }
        if (line) lines.push(line);
        return lines.length ? lines : [''];
      };
      const newPage = async (index: number): Promise<{ page: PDFPage; y: number }> => {
        const [page] = await output.copyPages(template, [0]);
        output.addPage(page);
        text(page, 'DELIVERY NOTE / PROOF OF DELIVERY', left, 755, 16, bold);
        text(page, note.noteNumber, left, 731, 10, bold);
        text(page, 'Delivery date: ' + note.deliveryDate, 365, 731, 9);
        if (index > 0) text(page, 'Continued - page ' + (index + 1), left, 712, 9, regular);
        return { page, y: index === 0 ? 708 : 688 };
      };
      let pageIndex = 0;
      let state = await newPage(pageIndex);
      const customerLines = wrapped('Delivered to: ' + note.customerName, regular, 10, right - left);
      for (const line of customerLines) { text(state.page, line, left, state.y); state.y -= 15; }
      const addressLines = wrapped('Delivery address: ' + (note.deliveryAddress || 'Not specified'), regular, 10, right - left);
      for (const line of addressLines) { text(state.page, line, left, state.y); state.y -= 15; }
      state.y -= 12;
      const header = (page: PDFPage, y: number) => {
        page.drawRectangle({ x: left, y: y - 8, width: right - left, height: 23, color: rgb(.93,.93,.93) });
        text(page, '#', left + 5, y, 9, bold);
        text(page, 'Article', left + 32, y, 9, bold);
        text(page, 'Product', left + 135, y, 9, bold);
        text(page, 'Qty', right - 35, y, 9, bold);
        return y - 25;
      };
      state.y = header(state.page, state.y);
      for (let i = 0; i < note.items.length; i++) {
        const item = note.items[i];
        const nameLines = wrapped(item.productName, regular, 9, 215);
        const articleLines = wrapped(item.articleNumber, regular, 9, 98);
        const height = Math.max(nameLines.length, articleLines.length) * 13 + 8;
        if (state.y - height < 240) {
          state = await newPage(++pageIndex);
          state.y = header(state.page, state.y);
        }
        text(state.page, i + 1, left + 5, state.y, 9);
        articleLines.forEach((line, j) => text(state.page, line, left + 32, state.y - j * 13, 9));
        nameLines.forEach((line, j) => text(state.page, line, left + 135, state.y - j * 13, 9));
        text(state.page, item.quantity, right - 35, state.y, 9);
        state.y -= height;
        // No horizontal row separator: it can visually strike through subsequent item text.
      }
      const consignment = note.paymentModel === 'Consignment' || note.paymentModel === 'Consignment (Monthly Settlement)';
      const ack = consignment
        ? 'Receipt confirms quantities delivered only. Consignment receipt is not payment or transfer of ownership. Commercial terms are governed by the parties agreement.'
        : 'I acknowledge receipt of the products and quantities listed. Signature confirms receipt only, not payment.';
      const remarks = note.remarks ? wrapped('Remarks: ' + note.remarks, regular, 9, right - left) : [];
      const ackLines = wrapped(ack, regular, 9, right - left);
      const needed = (remarks.length + ackLines.length) * 13 + 133;
      if (state.y - needed < 96) state = await newPage(++pageIndex);
      state.y -= 14;
      for (const line of remarks) { text(state.page, line, left, state.y, 9); state.y -= 13; }
      state.y -= 8;
      for (const line of ackLines) { text(state.page, line, left, state.y, 9); state.y -= 13; }
      state.y -= 32;
      text(state.page, 'RECEIVED BY (CUSTOMER)', left, state.y, 9, bold);
      text(state.page, 'DELIVERED BY (KORA)', 308, state.y, 9, bold);
      for (const [i, label] of ['Name', 'Signature', 'Date'].entries()) {
        const y = state.y - 24 - i * 28;
        text(state.page, label + ':', left, y, 9);
        text(state.page, label + ':', 308, y, 9);
        state.page.drawLine({ start: { x: left + 66, y: y - 2 }, end: { x: 276, y: y - 2 }, thickness: .5, color: gray });
        state.page.drawLine({ start: { x: 374, y: y - 2 }, end: { x: right, y: y - 2 }, thickness: .5, color: gray });
      }
      const blob = new Blob([new Uint8Array(await output.save())], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = note.noteNumber + '.pdf';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not generate delivery note PDF');
    }
  }
  uploadSigned(note: DeliveryNote, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type) || file.size > 15 * 1024 * 1024) {
      this.error.set('Choose a PDF, PNG or JPEG smaller than 15MB'); input.value = ''; return;
    }
    this.error.set(''); this.success.set('');
    this.api.uploadFile(file).subscribe({
      next: uploaded => this.api.attachDeliveryNoteSignedCopy(note.id, uploaded).subscribe({
        next: () => { this.success.set('Signed copy saved for ' + note.noteNumber); this.reload(); input.value = ''; },
        error: () => this.error.set('File uploaded but could not be linked to delivery note'),
      }),
      error: () => this.error.set('Signed copy upload failed'),
    });
  }
  downloadSigned(note: DeliveryNote): void {
    if (!note.signedFilePath) return;
    this.api.downloadFile(note.signedFilePath).subscribe({
      next: blob => { const url = URL.createObjectURL(blob); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000); },
      error: () => this.error.set('Could not open signed copy'),
    });
  }
}
