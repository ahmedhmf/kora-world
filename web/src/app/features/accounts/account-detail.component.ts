import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AccountsStore } from '../../store/accounts.store';
import { B2BAccount, AccountStatus } from '../../core/models/account.model';
import { Receipt, ReceiptStatus } from '../../core/models/receipt.model';

@Component({
  selector: 'app-account-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="p-8 max-w-5xl mx-auto">

      <!-- Back nav -->
      <a routerLink="/accounts" class="text-zinc-500 hover:text-zinc-300 text-sm mb-6 inline-flex items-center gap-1 transition-colors">
        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Accounts
      </a>

      <!-- Loading state -->
      @if (loading()) {
        <div class="text-zinc-500 text-sm py-12 text-center">Loading account details...</div>
      }

      <!-- Error state -->
      @if (error()) {
        <div class="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
          {{ error() }}
        </div>
      }

      @if (account(); as acct) {

        <!-- ── Page Header ──────────────────────────────────── -->
        <div class="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
          <div class="flex items-start gap-4">

            <!-- Company Avatar -->
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white flex-shrink-0"
              [class]="getAvatarBg(acct.customerType)">
              {{ acct.companyName[0]?.toUpperCase() }}
            </div>

            <div>
              <div class="flex items-center gap-3 flex-wrap">
                <h1 class="text-2xl font-bold text-white">{{ acct.companyName }}</h1>
                <span [class]="getStatusClass(acct.status)"
                  class="px-3 py-1 rounded-full text-xs font-bold border">
                  {{ getStatusLabel(acct.status) }}
                </span>
              </div>
              <p class="text-zinc-400 text-sm mt-1">{{ acct.customerType }}</p>
              <p class="text-zinc-600 font-mono text-xs mt-0.5">{{ acct.accountNumber }}</p>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <a
              [routerLink]="['/receipts/new']"
              [queryParams]="{ accountId: acct.id }"
              class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
              </svg>
              New Receipt
            </a>
            <a
              [routerLink]="['/accounts', acct.id, 'edit']"
              class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit
            </a>
            <button
              (click)="confirmDelete(acct.id)"
              class="px-4 py-2 bg-red-950/40 hover:bg-red-900/50 text-red-400 hover:text-red-300 text-sm font-medium rounded-lg border border-red-900/50 transition-colors flex items-center gap-1.5"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        </div>

        <!-- ── Stats Bar ────────────────────────────────────── -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
            <p class="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-1">Credit Limit</p>
            <p class="text-white text-xl font-bold font-mono">
              {{ acct.creditLimit | currency: acct.defaultCurrency:'symbol':'1.0-0' }}
            </p>
          </div>
          <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
            <p class="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-1">Currency</p>
            <p class="text-white text-xl font-bold">{{ acct.defaultCurrency }}</p>
          </div>
          <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
            <p class="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-1">Payment Terms</p>
            <p class="text-white text-lg font-semibold">{{ acct.paymentTerms || '—' }}</p>
          </div>
          <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
            <p class="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-1">Member Since</p>
            <p class="text-white text-lg font-semibold">{{ acct.createdAt | date:'MMM yyyy' }}</p>
          </div>
        </div>

        <!-- ── Detail Sections ──────────────────────────────── -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

          <!-- Primary Contact Card -->
          <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
            <h2 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Primary Contact
            </h2>
            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {{ acct.primaryContactName[0]?.toUpperCase() }}
                </div>
                <div>
                  <p class="text-white font-semibold text-sm">{{ acct.primaryContactName }}</p>
                  <a [href]="'mailto:' + acct.primaryContactEmail"
                    class="text-zinc-400 hover:text-white text-xs transition-colors">
                    {{ acct.primaryContactEmail }}
                  </a>
                </div>
              </div>
              @if (acct.primaryContactPhone) {
                <div class="flex items-center gap-2 pt-1">
                  <svg class="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span class="text-zinc-300 text-sm">{{ acct.primaryContactPhone }}</span>
                </div>
              }
              @if (acct.website) {
                <div class="flex items-center gap-2">
                  <svg class="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  <a [href]="acct.website" target="_blank" class="text-zinc-400 hover:text-white text-sm transition-colors truncate">
                    {{ acct.website }}
                  </a>
                </div>
              }
            </div>
          </div>

          <!-- Company Details Card -->
          <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
            <h2 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Company Details
            </h2>
            <dl class="space-y-3">
              <div class="flex justify-between items-baseline">
                <dt class="text-zinc-500 text-xs">Account No.</dt>
                <dd class="text-white text-xs font-mono font-bold">{{ acct.accountNumber }}</dd>
              </div>
              @if (acct.vatNumber) {
                <div class="flex justify-between items-baseline">
                  <dt class="text-zinc-500 text-xs">VAT Number</dt>
                  <dd class="text-white text-xs font-mono">{{ acct.vatNumber }}</dd>
                </div>
              }
              <div class="flex justify-between items-baseline">
                <dt class="text-zinc-500 text-xs">Type</dt>
                <dd class="text-zinc-200 text-xs font-medium">{{ acct.customerType }}</dd>
              </div>
              <div class="flex justify-between items-baseline">
                <dt class="text-zinc-500 text-xs">Created</dt>
                <dd class="text-zinc-200 text-xs">{{ acct.createdAt | date:'dd MMM yyyy' }}</dd>
              </div>
              <div class="flex justify-between items-baseline">
                <dt class="text-zinc-500 text-xs">Last Updated</dt>
                <dd class="text-zinc-200 text-xs">{{ acct.updatedAt | date:'dd MMM yyyy' }}</dd>
              </div>
            </dl>
          </div>

          <!-- Billing Address Card -->
          @if (acct.billingStreet || acct.billingCity || acct.billingCountry) {
            <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
              <h2 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Billing Address
              </h2>
              <address class="not-italic text-sm text-zinc-300 space-y-0.5">
                @if (acct.billingStreet) { <p>{{ acct.billingStreet }}</p> }
                @if (acct.billingCity || acct.billingZip) {
                  <p>{{ acct.billingCity }}{{ acct.billingCity && acct.billingZip ? ', ' : '' }}{{ acct.billingZip }}</p>
                }
                @if (acct.billingCountry) { <p class="text-zinc-400">{{ acct.billingCountry }}</p> }
              </address>
            </div>
          }

          <!-- Shipping Address Card -->
          @if (acct.shippingStreet || acct.shippingCity || acct.shippingCountry) {
            <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
              <h2 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Shipping Address
              </h2>
              <address class="not-italic text-sm text-zinc-300 space-y-0.5">
                @if (acct.shippingStreet) { <p>{{ acct.shippingStreet }}</p> }
                @if (acct.shippingCity || acct.shippingZip) {
                  <p>{{ acct.shippingCity }}{{ acct.shippingCity && acct.shippingZip ? ', ' : '' }}{{ acct.shippingZip }}</p>
                }
                @if (acct.shippingCountry) { <p class="text-zinc-400">{{ acct.shippingCountry }}</p> }
              </address>
            </div>
          }

          <!-- Remarks Card -->
          @if (acct.remarks) {
            <div class="md:col-span-2 bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
              <h2 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Internal Remarks
              </h2>
              <p class="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed">{{ acct.remarks }}</p>
            </div>
          }

        </div>

        <!-- ── Receipts Section ─────────────────────────────── -->
        <div class="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">

          <!-- Section header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/40">
            <div class="flex items-center gap-2">
              <svg class="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
              <h2 class="text-sm font-semibold text-white">Receipts</h2>
              @if (receipts().length > 0) {
                <span class="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded-full font-medium">
                  {{ receipts().length }}
                </span>
              }
            </div>
            <a
              routerLink="/receipts/new"
              class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
            >
              <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
              </svg>
              New
            </a>
          </div>

          <!-- Receipts loading -->
          @if (receiptsLoading()) {
            <div class="p-8 text-center text-zinc-500 text-sm">Loading receipts...</div>
          }

          <!-- Receipts table -->
          @if (!receiptsLoading()) {
            @if (receipts().length > 0) {
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="text-zinc-600 uppercase tracking-wider text-[10px] border-b border-zinc-900">
                    <th class="px-5 py-3 font-semibold">Receipt #</th>
                    <th class="px-5 py-3 font-semibold">Issue Date</th>
                    <th class="px-5 py-3 font-semibold">Due Date</th>
                    <th class="px-5 py-3 font-semibold text-right">Total</th>
                    <th class="px-5 py-3 font-semibold text-center">Status</th>
                    <th class="px-5 py-3 font-semibold text-center w-16">View</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-900">
                  @for (r of receipts(); track r.id) {
                    <tr class="hover:bg-zinc-900/30 transition-colors">
                      <td class="px-5 py-3 font-mono font-bold text-zinc-300">{{ r.receiptNumber }}</td>
                      <td class="px-5 py-3 text-zinc-400">{{ r.issueDate | date:'dd MMM yyyy' }}</td>
                      <td class="px-5 py-3">
                        @if (r.dueDate) {
                          <span [class]="isDue(r) ? 'text-red-400' : 'text-zinc-400'">
                            {{ r.dueDate | date:'dd MMM yyyy' }}
                          </span>
                        } @else {
                          <span class="text-zinc-700">—</span>
                        }
                      </td>
                      <td class="px-5 py-3 text-right font-mono font-bold text-zinc-100">
                        {{ r.totalAmount | currency: r.currency:'symbol':'1.2-2' }}
                      </td>
                      <td class="px-5 py-3 text-center">
                        <span [class]="getReceiptStatusClass(r.status)"
                          class="px-2.5 py-1 rounded-full text-[10px] font-bold border">
                          {{ getReceiptStatusLabel(r.status) }}
                        </span>
                      </td>
                      <td class="px-5 py-3 text-center">
                        <a [routerLink]="['/receipts', r.id]"
                          class="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition-colors inline-flex items-center justify-center"
                          title="View receipt">
                          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </a>
                      </td>
                    </tr>
                  }
                </tbody>
                <!-- Receipts total footer -->
                <tfoot>
                  <tr class="border-t border-zinc-800 bg-zinc-900/30">
                    <td colspan="3" class="px-5 py-3 text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                      {{ receipts().length }} receipt{{ receipts().length !== 1 ? 's' : '' }}
                    </td>
                    <td class="px-5 py-3 text-right font-mono font-bold text-white">
                      {{ receiptTotal() | currency: acct.defaultCurrency:'symbol':'1.2-2' }}
                    </td>
                    <td colspan="2"></td>
                  </tr>
                </tfoot>
              </table>
            } @else {
              <div class="p-10 text-center">
                <p class="text-zinc-600 text-sm mb-3">No receipts yet for this account.</p>
                <a routerLink="/receipts/new"
                  class="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-lg transition-colors">
                  <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
                  </svg>
                  Create first receipt
                </a>
              </div>
            }
          }

        </div>

      }
    </div>
  `,
})
export class AccountDetailComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly store = inject(AccountsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  account = signal<B2BAccount | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  receipts = signal<Receipt[]>([]);
  receiptsLoading = signal(false);

  receiptTotal(): number {
    return this.receipts()
      .filter((r) => r.status !== 'cancelled')
      .reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.loading.set(true);
        this.api.getAccount(+id).subscribe({
          next: (acct) => {
            this.account.set(acct);
            this.loading.set(false);
          },
          error: (err) => {
            this.error.set('Failed to load account details.');
            this.loading.set(false);
            console.error(err);
          }
        });

        // Load receipts for this account
        this.receiptsLoading.set(true);
        this.api.getAccountReceipts(+id).subscribe({
          next: (receipts) => {
            this.receipts.set(receipts);
            this.receiptsLoading.set(false);
          },
          error: () => {
            this.receiptsLoading.set(false);
          }
        });
      }
    });
  }

  confirmDelete(id: number): void {
    if (confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
      this.store.deleteAccount(id);
      this.router.navigate(['/accounts']);
    }
  }

  isDue(r: Receipt): boolean {
    if (!r.dueDate || r.status === 'paid' || r.status === 'cancelled') return false;
    return new Date(r.dueDate) < new Date();
  }

  getStatusClass(status: AccountStatus): string {
    switch (status) {
      case 'active':           return 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60';
      case 'under_discussion': return 'bg-amber-950/40 text-amber-400 border-amber-800/60';
      case 'suspended':        return 'bg-red-950/40 text-red-400 border-red-800/60';
      case 'inactive':
      default:                 return 'bg-zinc-800/50 text-zinc-400 border-zinc-700/60';
    }
  }

  getStatusLabel(status: AccountStatus): string {
    const labels: Record<AccountStatus, string> = {
      active: 'Active', under_discussion: 'Under Discussion',
      suspended: 'Suspended', inactive: 'Inactive',
    };
    return labels[status] ?? status;
  }

  getReceiptStatusClass(status: ReceiptStatus): string {
    switch (status) {
      case 'paid':      return 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60';
      case 'issued':    return 'bg-blue-950/40 text-blue-400 border-blue-800/60';
      case 'draft':     return 'bg-zinc-800/50 text-zinc-400 border-zinc-700/60';
      case 'overdue':   return 'bg-red-950/40 text-red-400 border-red-800/60';
      case 'cancelled': return 'bg-zinc-900/50 text-zinc-600 border-zinc-800/60';
      default:          return 'bg-zinc-800/50 text-zinc-400 border-zinc-700/60';
    }
  }

  getReceiptStatusLabel(status: ReceiptStatus): string {
    const labels: Record<ReceiptStatus, string> = {
      draft: 'Draft', issued: 'Issued', paid: 'Paid',
      overdue: 'Overdue', cancelled: 'Cancelled',
    };
    return labels[status] ?? status;
  }

  getAvatarBg(type: string): string {
    const map: Record<string, string> = {
      'Retailer':         'bg-gradient-to-br from-blue-600 to-indigo-700',
      'Distributor':      'bg-gradient-to-br from-violet-600 to-purple-700',
      'Sports Club':      'bg-gradient-to-br from-emerald-600 to-teal-700',
      'School / Academy': 'bg-gradient-to-br from-amber-600 to-orange-700',
      'Corporate':        'bg-gradient-to-br from-zinc-600 to-zinc-700',
      'Other':            'bg-gradient-to-br from-pink-600 to-rose-700',
    };
    return map[type] ?? 'bg-zinc-700';
  }
}
