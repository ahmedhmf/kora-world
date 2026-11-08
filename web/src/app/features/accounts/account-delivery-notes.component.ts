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
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escape(note.noteNumber)} — Kora Delivery Note</title><style>
      *{box-sizing:border-box}
      @page{size:A4 portrait;margin:0}
      html,body{margin:0;padding:0;width:210mm;min-height:297mm;color:#171717;font-family:Arial,Helvetica,sans-serif;font-size:10pt;line-height:1.4;background:#fff}
      .sheet{position:relative;width:210mm;min-height:297mm;padding-top:11mm;padding-bottom:15mm}
      .top-logo{position:absolute;top:4.8mm;right:19mm;font-size:15pt;font-weight:900;font-style:italic;letter-spacing:-1px;line-height:1}
      .frame{position:relative;margin:0 14mm 0 14mm;border:0.5mm solid #252525;min-height:261mm;padding:13mm 11mm 14mm}
      h1{font-size:18pt;letter-spacing:0.5px;margin:0 0 2mm}
      .meta{display:flex;justify-content:space-between;gap:8mm;padding-bottom:6mm;border-bottom:1px solid #bbb}
      .meta-right{text-align:right;white-space:nowrap}
      .customer{margin-top:7mm;line-height:1.7}
      table{width:100%;border-collapse:collapse;margin-top:8mm;table-layout:fixed}
      th,td{border-bottom:1px solid #bbb;padding:3mm 2mm;text-align:left;vertical-align:top;overflow-wrap:anywhere}
      th{background:#f1f1f1;font-size:9pt}
      th:first-child,td:first-child{width:8%}
      th:nth-child(2),td:nth-child(2){width:26%}
      th:last-child,td:last-child{width:20%;text-align:right}
      tr{break-inside:avoid}
      .remarks{margin-top:7mm;overflow-wrap:anywhere}
      .ack{margin-top:9mm;border:1px solid #aaa;padding:4mm;font-size:9pt;break-inside:avoid}
      .ack p{margin:2mm 0 0}
      .signatures{display:flex;gap:9mm;margin-top:15mm;break-inside:avoid}
      .signature{width:50%;font-size:9pt}
      .signature-line{border-bottom:1px solid #555;height:12mm;margin-bottom:2mm}
      .signature p{margin:0 0 5mm}
      .footer{position:absolute;left:14mm;right:14mm;bottom:5.5mm;height:7mm;background:#201d1e;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 4mm;font-size:5.5pt}
      .footer-brand{font-size:12pt;font-style:italic;font-weight:900;letter-spacing:-1px}
      .footer-center{font-size:10pt}
      @media print{
        html,body{print-color-adjust:exact;-webkit-print-color-adjust:exact}
        .sheet{break-after:page}
        .frame{break-inside:auto}
      }
    </style></head><body><div class="sheet">
      <div class="top-logo">KORA</div>
      <main class="frame">
        <div class="meta"><div><h1>DELIVERY NOTE</h1><div>Proof of Delivery</div></div>
          <div class="meta-right"><strong>${escape(note.noteNumber)}</strong><div>Delivery date: ${escape(note.deliveryDate)}</div></div>
        </div>
        <div class="customer"><strong>Delivered to:</strong> ${escape(note.customerName)}<br><strong>Delivery address:</strong> ${escape(note.deliveryAddress || 'Not specified')}</div>
        <table><thead><tr><th>#</th><th>Article</th><th>Product</th><th>Qty.</th></tr></thead><tbody>${rows}</tbody></table>
        ${note.remarks ? `<div class="remarks"><strong>Remarks:</strong> ${escape(note.remarks)}</div>` : ''}
        <div class="ack">I acknowledge receipt of the products and quantities listed above. Any shortages or visible damage should be noted upon delivery.
          ${consignment ? '<p><strong>Consignment:</strong> Receipt does not constitute payment or transfer of ownership. Commercial terms are governed by the parties\' agreement.</p>' : '<p>Signature confirms receipt only, not payment.</p>'}
        </div>
        <div class="signatures">
          <div class="signature"><strong>Received by (Customer)</strong><div class="signature-line"></div><p>Name:</p><div class="signature-line"></div><p>Signature:</p><div class="signature-line"></div><p>Date:</p></div>
          <div class="signature"><strong>Delivered by (Kora)</strong><div class="signature-line"></div><p>Name:</p><div class="signature-line"></div><p>Signature:</p><div class="signature-line"></div><p>Date:</p></div>
        </div>
      </main>
      <div class="footer"><span class="footer-brand">KORA</span><span class="footer-center">◆</span><span>Made in Egypt. Engineered in Germany.</span></div>
    </div><script>window.onload=function(){window.print()}<\/script></body></html>`);
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
