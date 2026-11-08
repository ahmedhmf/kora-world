import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { B2BAccount } from '../../core/models/account.model';
import { Product } from '../../core/models/product.model';

interface DeliveryItem { productId: number; quantity: number; }
interface DeliveryNote {
  id: number; noteNumber: string; deliveryDate: string; customerName: string;
  deliveryAddress?: string; paymentModel?: string; remarks?: string;
  items: Array<{ articleNumber: string; productName: string; quantity: number }>;
  signedFilePath?: string; signedFileName?: string;
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
        <h3 class="text-sm font-semibold text-zinc-300">Products delivered</h3>
        @for (item of items; track $index; let i = $index) {
          <div class="flex gap-3 items-center flex-wrap">
            <select [(ngModel)]="item.productId" class="bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-white flex-1 min-w-48">
              <option [ngValue]="0">Select product...</option>
              @for (product of products(); track product.id) {
                <option [ngValue]="product.id">{{ product.articleNumber }} — {{ product.name }}</option>
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
        <button type="button" [disabled]="saving()" (click)="create()" class="bg-white text-zinc-900 font-semibold rounded-lg px-4 py-2 disabled:opacity-50">Save Delivery Note</button>
      </section>

      <section class="space-y-3">
        <h2 class="font-semibold text-white">Saved Delivery Notes</h2>
        @for (note of notes(); track note.id) {
          <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-white font-semibold">{{ note.noteNumber }}</p>
              <p class="text-zinc-400 text-sm">{{ note.deliveryDate }} · {{ note.items.length }} product lines</p>
              <p class="text-xs" [class.text-emerald-400]="note.signedFilePath" [class.text-amber-400]="!note.signedFilePath">
                {{ note.signedFilePath ? 'Signed copy uploaded' : 'Awaiting signed copy' }}
              </p>
            </div>
            <div class="flex items-center gap-3 flex-wrap">
              <button type="button" (click)="print(note)" class="bg-zinc-700 text-white px-3 py-2 rounded-lg text-sm">Print / Save PDF</button>
              @if (note.signedFilePath) {
                <button type="button" (click)="downloadSigned(note)" class="text-blue-400 text-sm">View signed copy</button>
              }
              <label class="cursor-pointer bg-zinc-800 text-white px-3 py-2 rounded-lg text-sm">
                Upload signed copy
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" class="hidden" (change)="uploadSigned(note, $event)" />
              </label>
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
  items: DeliveryItem[] = [{ productId: 0, quantity: 1 }];

  ngOnInit(): void {
    this.accountId = Number(this.route.snapshot.paramMap.get('id'));
    this.api.getAccount(this.accountId).subscribe({ next: a => this.account.set(a), error: () => this.error.set('Could not load account') });
    this.api.getProducts().subscribe({ next: p => this.products.set(p), error: () => this.error.set('Could not load products') });
    this.reload();
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
    this.saving.set(true);
    this.api.createDeliveryNote(this.accountId, { deliveryDate: this.deliveryDate, remarks: this.remarks, items: this.items.map(i => ({ productId: Number(i.productId), quantity: Number(i.quantity) })) }).subscribe({
      next: note => { this.saving.set(false); this.items = [{ productId: 0, quantity: 1 }]; this.remarks = ''; this.success.set(note.noteNumber + ' saved. Print and obtain customer signature.'); this.reload(); },
      error: err => { this.saving.set(false); this.error.set(err.error?.message || 'Could not create delivery note'); },
    });
  }
  print(note: DeliveryNote): void {
    const escape = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
    const rows = note.items.map((i, idx) => `<tr><td>${idx + 1}</td><td>${escape(i.articleNumber)}</td><td>${escape(i.productName)}</td><td style="text-align:right">${i.quantity}</td></tr>`).join('');
    const consignment = note.paymentModel === 'Consignment' || note.paymentModel === 'Consignment (Monthly Settlement)';
    const popup = window.open('', '_blank');
    if (!popup) { this.error.set('Allow popups to print delivery notes'); return; }
    popup.document.write(`<!doctype html><html><head><title>${escape(note.noteNumber)} — Kora World Delivery Note</title><style>
      body{font:14px Arial,sans-serif;color:#151515;margin:40px;line-height:1.5}h1{font-size:26px;margin:0}header{display:flex;justify-content:space-between;border-bottom:3px solid #111;padding-bottom:20px;margin-bottom:24px}
      table{width:100%;border-collapse:collapse;margin:28px 0}th,td{padding:11px;border-bottom:1px solid #ccc;text-align:left}th{background:#eee}
      .signatures{display:flex;gap:50px;margin-top:70px}.signature{flex:1;border-top:1px solid #333;padding-top:10px}.muted{color:#555}.note{border:1px solid #aaa;padding:12px;margin-top:24px}
      @media print{body{margin:12mm}@page{size:A4;margin:12mm}}
    </style></head><body>
      <header><div><h1>KORA WORLD</h1><strong>DELIVERY NOTE / PROOF OF DELIVERY</strong></div><div><strong>${escape(note.noteNumber)}</strong><br>Delivery date: ${escape(note.deliveryDate)}</div></header>
      <p><strong>Delivered to:</strong> ${escape(note.customerName)}<br><strong>Delivery address:</strong> ${escape(note.deliveryAddress || 'Not specified')}</p>
      <table><thead><tr><th>#</th><th>Article</th><th>Product</th><th>Quantity delivered</th></tr></thead><tbody>${rows}</tbody></table>
      ${note.remarks ? `<p><strong>Remarks:</strong> ${escape(note.remarks)}</p>` : ''}
      <div class="note">I acknowledge receipt of the products and quantities listed above. Any shortages or visible damage should be recorded at delivery.
      ${consignment ? '<p><strong>Consignment:</strong> Receipt does not constitute payment or transfer of ownership. Commercial terms are governed by the parties\' agreement.</p>' : '<p>Signature confirms receipt only, not payment.</p>'}</div>
      <div class="signatures"><div class="signature">Received by (print name):<br><br>Signature:<br><br>Date:</div><div class="signature">Delivered by (print name):<br><br>Signature:<br><br>Date:</div></div>
      <script>window.onload=function(){window.print()}<\/script>
    </body></html>`);
    popup.document.close();
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
