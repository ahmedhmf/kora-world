import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingStore } from '../../store/accounting.store';
import { PurchaseOrdersStore } from '../../store/purchase-orders.store';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-8 max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white">Payments</h1>
          <p class="text-zinc-400 text-sm mt-1">Record expenses and cash outflows directly to the chart of accounts.</p>
        </div>
        <button
          (click)="openCreateModal()"
          class="px-5 py-2.5 bg-white text-zinc-900 hover:bg-zinc-100 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
          </svg>
          Record Payment
        </button>
      </div>

      <!-- Table -->
      <div class="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-zinc-900/60 border-b border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px] font-semibold">
                <th class="p-4">Date</th>
                <th class="p-4">Description</th>
                <th class="p-4">Paid From</th>
                <th class="p-4">Category</th>
                <th class="p-4">Reference</th>
                <th class="p-4 text-right">Amount</th>
                <th class="p-4 text-right">Amount (EUR)</th>
                <th class="p-4 text-center w-20">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-900">
              @for (p of store.payments(); track p.id) {
                <tr class="hover:bg-zinc-900/35 transition-colors">
                  <td class="p-4 text-zinc-300 font-medium whitespace-nowrap">{{ p.date | date:'dd MMM yyyy' }}</td>
                  <td class="p-4 text-zinc-200 font-medium max-w-[200px] truncate" [title]="p.description">{{ p.description || '—' }}</td>
                  <td class="p-4 text-zinc-400 font-mono text-[11px]">{{ p.paidFromAccountId || '—' }}</td>
                  <td class="p-4 text-zinc-400 font-mono text-[11px]">{{ p.categoryAccountId || '—' }}</td>
                  <td class="p-4 text-zinc-300 font-semibold font-mono">{{ p.reference || '—' }}</td>
                  <td class="p-4 text-right font-mono font-bold text-zinc-100 whitespace-nowrap">
                    {{ p.amount | currency: p.currency:'symbol':'1.2-2' }}
                  </td>
                  <td class="p-4 text-right font-mono font-bold text-zinc-300 whitespace-nowrap">
                    {{ p.amountEur | currency:'EUR':'symbol':'1.2-2' }}
                  </td>
                  <td class="p-4 text-center">
                    <button
                      (click)="deletePayment(p.id)"
                      class="p-1.5 bg-zinc-900 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 rounded transition-colors cursor-pointer"
                      title="Delete Payment"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="p-10 text-center text-zinc-500 font-medium">
                    No payments recorded yet.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Record Payment Modal -->
      @if (isCreateModalOpen()) {
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-black border border-zinc-800 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
            <!-- Modal Header -->
            <div class="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950 shrink-0">
              <h3 class="font-bold text-white text-base">💳 Record Payment</h3>
              <button (click)="isCreateModalOpen.set(false)" class="text-zinc-500 hover:text-white text-lg font-bold transition-colors cursor-pointer focus:outline-none">&times;</button>
            </div>

            <!-- Modal Body -->
            <div class="p-6 space-y-4 overflow-y-auto flex-1">

              <!-- Description (required) -->
              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-zinc-400">Description <span class="text-red-500">*</span></label>
                <input
                  type="text"
                  [(ngModel)]="newPayment.description"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600 placeholder-zinc-700"
                  placeholder="e.g. Handball samples from GEM"
                />
              </div>

              <!-- Date (required) -->
              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-zinc-400">Date <span class="text-red-500">*</span></label>
                <input
                  type="date"
                  [(ngModel)]="newPayment.date"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600"
                />
              </div>

              <!-- Paid From (required) -->
              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-zinc-400">Paid From <span class="text-red-500">*</span></label>
                <select
                  [(ngModel)]="newPayment.paidFromAccountId"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600"
                >
                  <option [ngValue]="0">Select account...</option>
                  @for (acc of paidFromAccounts; track acc.id) {
                    <option [ngValue]="acc.id">{{ acc.code }} — {{ acc.name }}</option>
                  }
                </select>
              </div>

              <!-- Amount + Currency row -->
              <div class="grid grid-cols-5 gap-3">
                <div class="col-span-3 space-y-1.5">
                  <label class="block text-xs font-medium text-zinc-400">Amount <span class="text-red-500">*</span></label>
                  <input
                    type="number"
                    [(ngModel)]="newPayment.amount"
                    (input)="calcAmountEur()"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600 text-right font-mono"
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                  />
                </div>
                <div class="col-span-2 space-y-1.5">
                  <label class="block text-xs font-medium text-zinc-400">Currency <span class="text-red-500">*</span></label>
                  <select
                    [(ngModel)]="newPayment.currency"
                    (change)="calcAmountEur()"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600 font-bold"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="EGP">EGP</option>
                  </select>
                </div>
              </div>

              <!-- Exchange Rate + Amount in EUR row -->
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-zinc-400">Exchange Rate (to EUR)</label>
                  <input
                    type="number"
                    [(ngModel)]="newPayment.exchangeRate"
                    (input)="calcAmountEur()"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600 text-right font-mono"
                    placeholder="auto"
                    min="0.000001"
                    step="0.000001"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-zinc-400">Amount in EUR</label>
                  <div class="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 text-right font-mono font-bold">
                    {{ amountEurDisplay() | number:'1.2-2' }}
                  </div>
                </div>
              </div>

              <!-- Category (required) -->
              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-zinc-400">Category <span class="text-red-500">*</span></label>
                <select
                  [(ngModel)]="newPayment.categoryAccountId"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600"
                >
                  <option [ngValue]="0">Select category...</option>
                  @for (acc of categoryAccounts; track acc.id) {
                    <option [ngValue]="acc.id">{{ acc.code }} — {{ acc.name }}</option>
                  }
                </select>
              </div>

              <!-- Reference # (optional) -->
              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-zinc-400">Reference #</label>
                <input
                  type="text"
                  [(ngModel)]="newPayment.reference"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600 placeholder-zinc-700"
                  placeholder="e.g. TXN-12345 (optional)"
                />
              </div>

              <!-- Link to PO (optional) -->
              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-zinc-400">Link to Purchase Order</label>
                <select
                  [(ngModel)]="newPayment.poId"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600"
                >
                  <option [ngValue]="null">None</option>
                  @for (po of poStore.purchaseOrders(); track po.id) {
                    <option [ngValue]="po.id">PO #{{ po.poNumber }} – {{ po.supplier?.name }}</option>
                  }
                </select>
              </div>

              <!-- Attachment (optional) -->
              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-zinc-400">Attachment</label>
                <div class="flex items-center gap-2 mt-1">
                  <input
                    type="file"
                    (change)="onFileSelected($event)"
                    class="hidden"
                    #fileInput
                  />
                  <button
                    type="button"
                    (click)="fileInput.click()"
                    class="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-xs rounded text-white font-medium cursor-pointer"
                  >
                    📎 Attach File
                  </button>
                  @if (isUploading()) {
                    <span class="text-[10px] text-zinc-500">Uploading...</span>
                  } @else if (attachmentName()) {
                    <span class="text-[10px] text-zinc-400 font-mono truncate max-w-[160px]" [title]="attachmentName()">{{ attachmentName() }}</span>
                    <button type="button" (click)="clearAttachment()" class="text-zinc-600 hover:text-red-400 text-xs cursor-pointer">✕</button>
                  }
                </div>
              </div>

              <!-- Notes (optional) -->
              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-zinc-400">Notes</label>
                <textarea
                  [(ngModel)]="newPayment.notes"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600 h-16 placeholder-zinc-700"
                  placeholder="Additional notes... (optional)"
                ></textarea>
              </div>

              <!-- Validation error -->
              @if (validationMsg()) {
                <div class="p-3 bg-red-950/40 border border-red-800/40 rounded text-red-400 text-xs font-semibold">
                  ⚠️ {{ validationMsg() }}
                </div>
              }
            </div>

            <!-- Modal Footer -->
            <div class="px-6 py-4 border-t border-zinc-800 bg-zinc-950 flex justify-end gap-3 shrink-0">
              <button
                (click)="isCreateModalOpen.set(false)"
                class="px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-white rounded text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                (click)="submitPayment()"
                [disabled]="!!validationMsg() || isUploading()"
                class="px-4 py-2 bg-white hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-900 rounded font-semibold text-xs transition-colors cursor-pointer"
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class PaymentsComponent implements OnInit {
  readonly store = inject(AccountingStore);
  readonly poStore = inject(PurchaseOrdersStore);
  readonly apiService = inject(ApiService);

  isCreateModalOpen = signal(false);
  isUploading = signal(false);
  attachmentName = signal('');

  // Derived from the store's full accounts list — filtered client-side
  get paidFromAccounts() {
    return this.store.accounts().filter(a => {
      const code = a.code ?? '';
      return code.startsWith('11') || code.startsWith('31');
    });
  }

  get categoryAccounts() {
    return this.store.accounts().filter(a =>
      a.type === 'expense' || (a.code ?? '').startsWith('5')
    );
  }

  newPayment = this.emptyPayment();

  amountEurDisplay() {
    const rate = this.newPayment.exchangeRate || 1;
    const amount = Number(this.newPayment.amount) || 0;
    return Number((amount * rate).toFixed(2));
  }

  validationMsg(): string | null {
    if (!this.newPayment.description?.trim()) return 'Description is required.';
    if (!this.newPayment.date) return 'Date is required.';
    if (!this.newPayment.paidFromAccountId || this.newPayment.paidFromAccountId === 0) return 'Please select a Paid From account.';
    if (!this.newPayment.amount || Number(this.newPayment.amount) <= 0) return 'Amount must be greater than 0.';
    if (!this.newPayment.categoryAccountId || this.newPayment.categoryAccountId === 0) return 'Please select a Category.';
    return null;
  }

  private emptyPayment() {
    return {
      description: '',
      date: new Date().toISOString().split('T')[0],
      paidFromAccountId: 0,
      amount: 0,
      currency: 'EUR',
      exchangeRate: 1 as number | undefined,
      categoryAccountId: 0,
      reference: '',
      poId: null as number | null,
      attachment: null as string | null,
      notes: '',
      method: 'bank_transfer',
      invoiceId: undefined as number | undefined,
    };
  }

  ngOnInit() {
    this.store.loadPayments();
    this.store.loadInvoices();
    this.store.loadAccounts();
    this.poStore.loadPurchaseOrders();
  }

  openCreateModal() {
    this.newPayment = this.emptyPayment();
    this.attachmentName.set('');
    this.isCreateModalOpen.set(true);
  }

  calcAmountEur() {
    // triggers re-render via normal change detection
  }

  onFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;
    this.isUploading.set(true);
    this.apiService.uploadFile(file).subscribe({
      next: (res) => {
        this.newPayment.attachment = res.path;
        this.attachmentName.set(res.name);
        this.isUploading.set(false);
      },
      error: () => {
        alert('File upload failed.');
        this.isUploading.set(false);
      },
    });
  }

  clearAttachment() {
    this.newPayment.attachment = null;
    this.attachmentName.set('');
  }

  submitPayment() {
    const err = this.validationMsg();
    if (err) return;

    const dto = {
      description: this.newPayment.description.trim(),
      date: this.newPayment.date,
      paidFromAccountId: Number(this.newPayment.paidFromAccountId),
      categoryAccountId: Number(this.newPayment.categoryAccountId),
      amount: Number(this.newPayment.amount),
      currency: this.newPayment.currency,
      exchangeRate: this.newPayment.exchangeRate ? Number(this.newPayment.exchangeRate) : undefined,
      reference: this.newPayment.reference || undefined,
      poId: this.newPayment.poId || undefined,
      attachment: this.newPayment.attachment || undefined,
      notes: this.newPayment.notes || undefined,
      method: this.newPayment.method,
      invoiceId: this.newPayment.invoiceId || undefined,
    };

    this.store.createPayment({
      dto,
      onSuccess: () => {
        this.isCreateModalOpen.set(false);
      },
    });
  }

  deletePayment(id: number) {
    if (confirm('Delete this payment? This will also remove the associated journal entry.')) {
      this.store.deletePayment(id);
    }
  }
}
