import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ReceiptsStore } from '../../store/receipts.store';
import { Receipt, ReceiptStatus, UpdateReceiptDto } from '../../core/models/receipt.model';

@Component({
  selector: 'app-receipt-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  styles: [`
    @media print {
      .no-print { display: none !important; }
      body { background: white !important; }
      .print-page { background: white !important; border: none !important; box-shadow: none !important; }
    }
  `],
  template: `
    <div class="p-8 max-w-4xl mx-auto">

      <!-- Back + Actions (no-print) -->
      <div class="no-print flex items-center justify-between mb-6">
        <a routerLink="/receipts" class="text-zinc-500 hover:text-zinc-300 text-sm transition-colors flex items-center gap-1">
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/>
          </svg>
          Back to Receipts
        </a>
        <div class="flex items-center gap-2">
          @if (receipt()?.status === 'draft') {
            <button (click)="changeStatus('issued')"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors">
              Mark as Issued
            </button>
          }
          @if (receipt()?.status === 'issued' || receipt()?.status === 'overdue') {
            <button (click)="changeStatus('paid')"
              class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors">
              Mark as Paid ✓
            </button>
          }
          @if (receipt()?.status !== 'cancelled' && receipt()?.status !== 'paid') {
            <button (click)="changeStatus('cancelled')"
              class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-medium rounded-lg transition-colors">
              Cancel
            </button>
          }
          <button (click)="print()"
            class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5">
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
            Print
          </button>
          <button (click)="confirmDelete()"
            class="px-4 py-2 bg-red-950/40 hover:bg-red-900/50 text-red-400 text-xs font-medium rounded-lg border border-red-900/50 transition-colors">
            Delete
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="text-zinc-500 text-sm py-12 text-center">Loading receipt...</div>
      }

      @if (receipt(); as r) {
        <!-- Invoice Card -->
        <div class="print-page bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">

          <!-- Header band -->
          <div class="bg-gradient-to-r from-zinc-900 to-zinc-950 border-b border-zinc-800 p-8">
            <div class="flex justify-between items-start">

              <!-- Company / Brand -->
              <div>
                <div class="flex items-center gap-3 mb-4">
                  <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <span class="text-white font-black text-sm">K</span>
                  </div>
                  <div>
                    <p class="text-white font-bold text-lg leading-none">Kora World</p>
                    <p class="text-zinc-500 text-xs mt-0.5">Sports & Lifestyle Equipment</p>
                  </div>
                </div>
              </div>

              <!-- Receipt Meta -->
              <div class="text-right">
                <p class="text-zinc-500 text-xs uppercase tracking-widest font-semibold mb-1">Receipt</p>
                <p class="text-white text-2xl font-black font-mono">{{ r.receiptNumber }}</p>
                <div class="mt-3">
                  <span [class]="getStatusClass(r.status)"
                    class="px-3 py-1 rounded-full text-xs font-bold border">
                    {{ getStatusLabel(r.status) }}
                  </span>
                </div>
              </div>

            </div>

            <!-- Dates row -->
            <div class="mt-6 grid grid-cols-3 gap-6">
              <div>
                <p class="text-zinc-600 text-[10px] uppercase tracking-wider font-semibold mb-0.5">Issue Date</p>
                <p class="text-white text-sm font-medium">{{ r.issueDate | date:'dd MMMM yyyy' }}</p>
              </div>
              <div>
                <p class="text-zinc-600 text-[10px] uppercase tracking-wider font-semibold mb-0.5">Due Date</p>
                <p [class]="isDue(r) ? 'text-red-400' : 'text-white'" class="text-sm font-medium">
                  {{ r.dueDate ? (r.dueDate | date:'dd MMMM yyyy') : '—' }}
                </p>
              </div>
              <div>
                <p class="text-zinc-600 text-[10px] uppercase tracking-wider font-semibold mb-0.5">Payment Terms</p>
                <p class="text-white text-sm font-medium">{{ r.paymentTerms || '—' }}</p>
              </div>
            </div>
          </div>

          <!-- Bill To block -->
          <div class="p-8 border-b border-zinc-800/60">
            <div class="grid grid-cols-2 gap-8">
              <div>
                <p class="text-zinc-600 text-[10px] uppercase tracking-wider font-semibold mb-3">Bill To</p>
                <p class="text-white font-bold text-base mb-1">{{ r.account?.companyName }}</p>
                <p class="text-zinc-400 text-sm">{{ r.account?.primaryContactName }}</p>
                <a [href]="'mailto:' + r.account?.primaryContactEmail" class="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
                  {{ r.account?.primaryContactEmail }}
                </a>
                @if (r.account?.billingStreet) {
                  <address class="not-italic mt-2 text-zinc-500 text-xs space-y-0.5">
                    <p>{{ r.account?.billingStreet }}</p>
                    <p>{{ r.account?.billingCity }}{{ r.account?.billingCity && r.account?.billingZip ? ', ' : '' }}{{ r.account?.billingZip }}</p>
                    <p>{{ r.account?.billingCountry }}</p>
                  </address>
                }
              </div>
              @if (r.account?.vatNumber) {
                <div>
                  <p class="text-zinc-600 text-[10px] uppercase tracking-wider font-semibold mb-3">VAT / Tax</p>
                  <p class="text-white text-sm font-mono">{{ r.account?.vatNumber }}</p>
                </div>
              }
            </div>
          </div>

          <!-- Line Items Table -->
          <div class="p-8">
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="border-b border-zinc-800 text-zinc-500 text-[10px] uppercase tracking-wider">
                  <th class="pb-3 text-left font-semibold w-24">Item #</th>
                  <th class="pb-3 text-left font-semibold">Description</th>
                  <th class="pb-3 text-right font-semibold">Qty</th>
                  <th class="pb-3 text-right font-semibold">Unit Price</th>
                  <th class="pb-3 text-right font-semibold">Disc %</th>
                  <th class="pb-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-900">
                @for (item of r.lineItems; track item.id) {
                  <tr>
                    <td class="py-3 text-zinc-500 font-mono text-xs">{{ item.articleNumber }}</td>
                    <td class="py-3 text-white font-medium">{{ item.description }}</td>
                    <td class="py-3 text-right text-zinc-300">{{ item.quantity }}</td>
                    <td class="py-3 text-right text-zinc-300 font-mono">
                      {{ item.unitPrice | currency: r.currency:'symbol':'1.2-2' }}
                    </td>
                    <td class="py-3 text-right text-zinc-400">
                      {{ item.discountPct > 0 ? (item.discountPct + '%') : '—' }}
                    </td>
                    <td class="py-3 text-right text-white font-bold font-mono">
                      {{ item.lineTotal | currency: r.currency:'symbol':'1.2-2' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>

            <!-- Totals Block -->
            <div class="mt-6 ml-auto max-w-xs space-y-2 text-sm border-t border-zinc-800 pt-5">
              <div class="flex justify-between text-zinc-400">
                <span>Subtotal</span>
                <span class="font-mono">{{ r.subtotal | currency: r.currency:'symbol':'1.2-2' }}</span>
              </div>
              @if (r.discountAmount > 0) {
                <div class="flex justify-between text-amber-400">
                  <span>Discount</span>
                  <span class="font-mono">− {{ r.discountAmount | currency: r.currency:'symbol':'1.2-2' }}</span>
                </div>
              }
              @if (r.vatRate > 0) {
                <div class="flex justify-between text-zinc-400">
                  <span>VAT ({{ r.vatRate }}%)</span>
                  <span class="font-mono">{{ r.taxAmount | currency: r.currency:'symbol':'1.2-2' }}</span>
                </div>
              }
              <div class="flex justify-between text-white font-bold text-lg border-t border-zinc-700 pt-3 mt-3">
                <span>Total</span>
                <span class="font-mono">{{ r.totalAmount | currency: r.currency:'symbol':'1.2-2' }}</span>
              </div>
            </div>

            <!-- Notes -->
            @if (r.notes) {
              <div class="mt-8 border-t border-zinc-800/60 pt-6">
                <p class="text-zinc-600 text-[10px] uppercase tracking-wider font-semibold mb-2">Notes</p>
                <p class="text-zinc-400 text-sm whitespace-pre-wrap">{{ r.notes }}</p>
              </div>
            }

            <!-- Footer -->
            <div class="mt-8 pt-6 border-t border-zinc-800/40 text-center">
              <p class="text-zinc-700 text-xs">Thank you for your business — Kora World</p>
            </div>
          </div>

        </div>
      }

    </div>
  `,
})
export class ReceiptDetailComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly store = inject(ReceiptsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  receipt = signal<Receipt | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.loading.set(true);
        this.api.getReceipt(+id).subscribe({
          next: (r) => { this.receipt.set(r); this.loading.set(false); },
          error: (err) => { this.error.set('Failed to load receipt.'); this.loading.set(false); console.error(err); },
        });
      }
    });
  }

  changeStatus(status: ReceiptStatus): void {
    const r = this.receipt();
    if (!r) return;
    const dto: UpdateReceiptDto = { status };
    this.api.updateReceipt(r.id, dto).subscribe({
      next: (updated) => {
        this.receipt.set({ ...r, ...updated });
        this.store.updateReceipt({ id: r.id, dto });
      },
      error: () => alert('Failed to update status.'),
    });
  }

  confirmDelete(): void {
    if (!confirm('Are you sure you want to delete this receipt? This cannot be undone.')) return;
    const r = this.receipt();
    if (!r) return;
    this.store.deleteReceipt(r.id);
    this.router.navigate(['/receipts']);
  }

  print(): void {
    window.print();
  }

  isDue(r: Receipt): boolean {
    if (!r.dueDate || r.status === 'paid' || r.status === 'cancelled') return false;
    return new Date(r.dueDate) < new Date();
  }

  getStatusClass(status: ReceiptStatus): string {
    switch (status) {
      case 'paid':      return 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60';
      case 'issued':    return 'bg-blue-950/40 text-blue-400 border-blue-800/60';
      case 'draft':     return 'bg-zinc-800/50 text-zinc-400 border-zinc-700/60';
      case 'overdue':   return 'bg-red-950/40 text-red-400 border-red-800/60';
      case 'cancelled': return 'bg-zinc-900/50 text-zinc-600 border-zinc-800/60';
      default:          return 'bg-zinc-800/50 text-zinc-400 border-zinc-700/60';
    }
  }

  getStatusLabel(status: ReceiptStatus): string {
    const labels: Record<ReceiptStatus, string> = {
      draft: 'Draft', issued: 'Issued', paid: 'Paid', overdue: 'Overdue', cancelled: 'Cancelled',
    };
    return labels[status] ?? status;
  }
}
