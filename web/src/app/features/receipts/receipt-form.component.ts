import { ChangeDetectorRef, Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ReceiptsStore } from '../../store/receipts.store';
import { ApiService } from '../../core/services/api.service';
import { AccountsStore } from '../../store/accounts.store';
import { B2BAccount } from '../../core/models/account.model';
import { CreateReceiptDto, CreateReceiptLineItemDto } from '../../core/models/receipt.model';
import { Product } from '../../core/models/product.model';

interface LineItemDraft {
  productId?: number;
  articleNumber: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  // computed UI helpers
  lineTotal: number;
}

@Component({
  selector: 'app-receipt-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="p-8 max-w-5xl mx-auto">

      <!-- Header -->
      <div class="mb-8">
        <a routerLink="/receipts" class="text-zinc-500 hover:text-zinc-300 text-sm mb-4 inline-block transition-colors">← Back to Receipts</a>
        <h1 class="text-2xl font-bold text-white">{{ isEdit() ? 'Edit Receipt' : 'New Receipt' }}</h1>
        <p class="text-zinc-400 text-sm mt-1">{{ isEdit() ? 'Update receipt details.' : 'Create a sales receipt for a B2B account.' }}</p>
      </div>

      @if (error()) {
        <div class="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">{{ error() }}</div>
      }

      <form #receiptForm="ngForm" (ngSubmit)="receiptForm.valid && lineItems.length > 0 && submit()" class="space-y-6">

        <!-- ── SECTION 1: Account & Header ───────────────────── -->
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
          <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-5">Receipt Details</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">

            <!-- Account Selector -->
            <div class="md:col-span-2" *ngIf="!isEdit()">
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Account *</label>

              <!-- Search box -->
              <div class="relative">
                <input
                  type="text"
                  [(ngModel)]="accountSearch"
                  (ngModelChange)="onAccountSearch($event)"
                  [placeholder]="selectedAccount() ? selectedAccount()!.companyName : 'Search account...'"
                  name="accountSearch"
                  class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-500"
                  autocomplete="off"
                />
                @if (showAccountDropdown() && filteredAccounts().length > 0) {
                  <div class="fixed-dropdown absolute left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 max-h-56 overflow-y-auto">
                    @for (acct of filteredAccounts(); track acct.id) {
                      <button type="button" (click)="selectAccount(acct)"
                        class="w-full text-left px-4 py-2.5 hover:bg-zinc-800 transition-colors">
                        <div class="text-white text-sm font-medium">{{ acct.companyName }}</div>
                        <div class="text-zinc-500 text-xs">{{ acct.customerType }} · {{ acct.defaultCurrency }}</div>
                      </button>
                    }
                  </div>
                }
              </div>

              @if (selectedAccount()) {
                <div class="mt-2 flex items-center gap-2 bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2">
                  <div class="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {{ selectedAccount()!.companyName[0] }}
                  </div>
                  <div>
                    <p class="text-white text-xs font-semibold">{{ selectedAccount()!.companyName }}</p>
                    <p class="text-zinc-400 text-[10px]">{{ selectedAccount()!.primaryContactEmail }}</p>
                  </div>
                  <button type="button" (click)="clearAccount()" class="ml-auto text-zinc-500 hover:text-zinc-300 transition-colors text-xs">✕</button>
                </div>
              }
            </div>

            <!-- Issue Date -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Issue Date *</label>
              <input
                type="date" [(ngModel)]="form.issueDate" name="issueDate" required #issueDateInput="ngModel"
                class="w-full bg-zinc-950 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none transition-colors"
                [class.border-zinc-700]="!issueDateInput.invalid || (!issueDateInput.dirty && !issueDateInput.touched)"
                [class.border-red-500]="issueDateInput.invalid && (issueDateInput.dirty || issueDateInput.touched)"
              />
            </div>

            <!-- Due Date -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Due Date</label>
              <input
                type="date" [(ngModel)]="form.dueDate" name="dueDate"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 transition-colors"
              />
            </div>

            <!-- Currency -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Currency</label>
              <select [(ngModel)]="form.currency" name="currency"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 appearance-none">
                @for (c of currencies; track c.code) {
                  <option [value]="c.code" class="bg-zinc-900">{{ c.code }} – {{ c.name }}</option>
                }
              </select>
            </div>

            <!-- VAT Rate -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">VAT Rate (%)</label>
              <input
                type="number" [(ngModel)]="form.vatRate" name="vatRate" min="0" max="100" step="0.5"
                (ngModelChange)="recalcTotals()"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500"
                placeholder="0"
              />
            </div>

            <!-- Payment Terms -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Payment Terms</label>
              <input [(ngModel)]="form.paymentTerms" name="paymentTerms"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                placeholder="e.g. Net 30, COD" />
            </div>

            <!-- Notes -->
            <div class="md:col-span-2">
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Notes</label>
              <textarea [(ngModel)]="form.notes" name="notes" rows="2"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 resize-none"
                placeholder="Optional notes visible on the receipt..."></textarea>
            </div>

          </div>
        </div>

        <!-- ── SECTION 2: Line Items ──────────────────────────── -->
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
          <div class="flex items-center justify-between mb-5">
            <div>
              <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Line Items *</h2>
              <p class="text-zinc-600 text-xs mt-0.5">Add products from the catalogue or enter manually.</p>
            </div>
            <button type="button" (click)="addLineItem()"
              class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-lg transition-colors">
              + Add Line
            </button>
          </div>

          <!-- Line items table header -->
          @if (lineItems.length > 0) {
            <div class="grid grid-cols-12 gap-2 text-[10px] text-zinc-600 uppercase tracking-wider font-semibold px-1 mb-2">
              <div class="col-span-4">Product / Description</div>
              <div class="col-span-1 text-right">Qty</div>
              <div class="col-span-2 text-right">Unit Price</div>
              <div class="col-span-2 text-right">Disc %</div>
              <div class="col-span-2 text-right">Line Total</div>
              <div class="col-span-1"></div>
            </div>
          }

          @for (item of lineItems; track $index; let i = $index) {
            <div class="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3 mb-3">

              <!-- Product picker row -->
              <div class="relative mb-3">
                <label class="block text-[10px] text-zinc-500 mb-1">Product (optional — type to search catalogue)</label>
                <input
                  type="text"
                  [value]="getProductLabel(item)"
                  (input)="onProductSearch($event, i)"
                  (focus)="openProductPicker(i)"
                  [name]="'productSearch_' + i"
                  placeholder="Search products..."
                  class="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-white text-xs focus:outline-none focus:border-zinc-600 placeholder-zinc-600"
                  autocomplete="off"
                />
                @if (activeProductPicker() === i && filteredProducts(i).length > 0) {
                  <div class="absolute left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 max-h-48 overflow-y-auto">
                    <div class="fixed inset-0 z-40" (click)="closeProductPicker()"></div>
                    @for (p of filteredProducts(i); track p.id) {
                      <button type="button" (click)="pickProduct(i, p)" class="relative z-50 w-full text-left px-3 py-2 hover:bg-zinc-800 transition-colors border-b border-zinc-800/50 last:border-0">
                        <div class="text-white text-xs font-semibold">{{ p.name }}</div>
                        <div class="text-zinc-500 text-[10px]">{{ p.articleNumber }} · {{ p.unitPrice | currency: 'USD':'symbol':'1.2-2' }}</div>
                      </button>
                    }
                  </div>
                }
              </div>

              <!-- Fields grid -->
              <div class="grid grid-cols-12 gap-2 items-end">

                <!-- Description -->
                <div class="col-span-4">
                  <label class="block text-[10px] text-zinc-500 mb-1">Description *</label>
                  <input
                    type="text"
                    [(ngModel)]="item.description"
                    [name]="'desc_' + i"
                    required
                    placeholder="Product description"
                    class="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-white text-xs focus:outline-none focus:border-zinc-600 placeholder-zinc-600"
                  />
                </div>

                <!-- Quantity -->
                <div class="col-span-1">
                  <label class="block text-[10px] text-zinc-500 mb-1">Qty *</label>
                  <input
                    type="number"
                    [(ngModel)]="item.quantity"
                    [name]="'qty_' + i"
                    min="1" required
                    (ngModelChange)="recalcLine(i)"
                    class="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2 py-2 text-white text-xs text-right focus:outline-none focus:border-zinc-600"
                  />
                </div>

                <!-- Unit Price -->
                <div class="col-span-2">
                  <label class="block text-[10px] text-zinc-500 mb-1">Unit Price *</label>
                  <input
                    type="number"
                    [(ngModel)]="item.unitPrice"
                    [name]="'price_' + i"
                    min="0" step="0.01" required
                    (ngModelChange)="recalcLine(i)"
                    class="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2 py-2 text-white text-xs text-right focus:outline-none focus:border-zinc-600"
                  />
                </div>

                <!-- Discount % -->
                <div class="col-span-2">
                  <label class="block text-[10px] text-zinc-500 mb-1">Disc %</label>
                  <input
                    type="number"
                    [(ngModel)]="item.discountPct"
                    [name]="'disc_' + i"
                    min="0" max="100" step="0.5"
                    (ngModelChange)="recalcLine(i)"
                    class="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2 py-2 text-white text-xs text-right focus:outline-none focus:border-zinc-600"
                  />
                </div>

                <!-- Line Total -->
                <div class="col-span-2 text-right">
                  <label class="block text-[10px] text-zinc-500 mb-1">Total</label>
                  <p class="text-white text-xs font-bold py-2 pr-1 font-mono">
                    {{ item.lineTotal | currency: (form.currency || 'USD'):'symbol':'1.2-2' }}
                  </p>
                </div>

                <!-- Remove -->
                <div class="col-span-1 text-right">
                  <button type="button" (click)="removeLineItem(i)"
                    class="w-full py-2 text-red-500 hover:text-red-400 text-xs font-semibold transition-colors">
                    ✕
                  </button>
                </div>

              </div>
            </div>
          }

          @if (lineItems.length === 0) {
            <div class="border border-dashed border-zinc-800 rounded-lg p-8 text-center">
              <p class="text-zinc-500 text-sm">No line items yet.</p>
              <button type="button" (click)="addLineItem()" class="text-white hover:underline text-xs font-medium mt-1 inline-block">
                Add the first item
              </button>
            </div>
          }
        </div>

        <!-- ── SECTION 3: Totals Panel ─────────────────────────── -->
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
          <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">Summary</h2>
          <div class="max-w-xs ml-auto space-y-2 text-sm">
            <div class="flex justify-between text-zinc-400">
              <span>Subtotal</span>
              <span class="font-mono">{{ totals().subtotal | currency: (form.currency || 'USD'):'symbol':'1.2-2' }}</span>
            </div>
            @if (totals().discountAmount > 0) {
              <div class="flex justify-between text-amber-400">
                <span>Discount</span>
                <span class="font-mono">− {{ totals().discountAmount | currency: (form.currency || 'USD'):'symbol':'1.2-2' }}</span>
              </div>
            }
            @if ((form.vatRate || 0) > 0) {
              <div class="flex justify-between text-zinc-400">
                <span>VAT ({{ form.vatRate }}%)</span>
                <span class="font-mono">{{ totals().taxAmount | currency: (form.currency || 'USD'):'symbol':'1.2-2' }}</span>
              </div>
            }
            <div class="flex justify-between text-white font-bold text-base border-t border-zinc-700 pt-2 mt-2">
              <span>Total</span>
              <span class="font-mono">{{ totals().totalAmount | currency: (form.currency || 'USD'):'symbol':'1.2-2' }}</span>
            </div>
          </div>
        </div>

        <!-- Submit -->
        <div class="flex items-center gap-3 pb-8">
          <button
            type="submit"
            [disabled]="saving() || receiptForm.invalid || lineItems.length === 0 || (!isEdit() && !selectedAccount())"
            class="px-6 py-2.5 bg-white text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ saving() ? 'Saving...' : (isEdit() ? 'Update Receipt' : 'Create Receipt') }}
          </button>
          <a routerLink="/receipts" class="px-6 py-2.5 bg-zinc-800 text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors">
            Cancel
          </a>
        </div>

      </form>
    </div>
  `,
})
export class ReceiptFormComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly accountsStore = inject(AccountsStore);

  isEdit = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  private editId = signal<number | null>(null);

  // Account picker state
  accountSearch = '';
  showAccountDropdown = signal(false);
  selectedAccount = signal<B2BAccount | null>(null);

  // Product picker state
  allProducts: Product[] = [];
  activeProductPicker = signal<number | null>(null);
  productSearchTerms: string[] = [];

  // Line items
  lineItems: LineItemDraft[] = [];

  // Form header
  form: Partial<CreateReceiptDto> = {
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    currency: 'USD',
    vatRate: 0,
    paymentTerms: '',
    notes: '',
  };

  readonly currencies = [
    { code: 'USD', name: 'US Dollar' }, { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' }, { code: 'EGP', name: 'Egyptian Pound' },
    { code: 'AED', name: 'UAE Dirham' }, { code: 'SAR', name: 'Saudi Riyal' },
    { code: 'MAD', name: 'Moroccan Dirham' },
  ];

  filteredAccounts = computed(() => {
    const q = this.accountSearch.toLowerCase().trim();
    if (!q) return this.accountsStore.accounts().slice(0, 8);
    return this.accountsStore.accounts().filter(
      (a) => a.companyName.toLowerCase().includes(q) || a.primaryContactEmail.toLowerCase().includes(q)
    ).slice(0, 8);
  });

  totals = computed(() => {
    let subtotal = 0;
    let discountAmount = 0;
    for (const item of this.lineItems) {
      const gross = item.unitPrice * item.quantity;
      const disc = gross * ((item.discountPct || 0) / 100);
      subtotal += gross;
      discountAmount += disc;
    }
    const net = subtotal - discountAmount;
    const taxAmount = net * ((this.form.vatRate || 0) / 100);
    return { subtotal, discountAmount, taxAmount, totalAmount: net + taxAmount };
  });

  ngOnInit(): void {
    this.accountsStore.loadAccounts();
    // Load all products for picker
    this.api.getProducts().subscribe({ next: (p) => { this.allProducts = p; } });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.isEdit.set(true);
        this.editId.set(+id);
        // Edit mode: only status/dueDate/notes editable, redirect to detail for status changes
        this.router.navigate(['/receipts', id]);
      }
    });
  }

  // ── Account picker ──────────────────────────────
  onAccountSearch(q: string): void {
    this.showAccountDropdown.set(q.length > 0);
  }

  selectAccount(acct: B2BAccount): void {
    this.selectedAccount.set(acct);
    this.showAccountDropdown.set(false);
    this.accountSearch = '';
    // Pre-fill currency + payment terms from account
    this.form.currency = acct.defaultCurrency || 'USD';
    this.form.paymentTerms = acct.paymentTerms || '';
  }

  clearAccount(): void {
    this.selectedAccount.set(null);
    this.accountSearch = '';
  }

  // ── Product picker ──────────────────────────────
  getProductLabel(item: LineItemDraft): string {
    if (item.productId) {
      const p = this.allProducts.find((pr) => pr.id === item.productId);
      return p ? `${p.articleNumber} – ${p.name}` : '';
    }
    return '';
  }

  filteredProducts(lineIndex: number): Product[] {
    const term = (this.productSearchTerms[lineIndex] || '').toLowerCase();
    if (!term) return this.allProducts.slice(0, 10);
    return this.allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.articleNumber.toLowerCase().includes(term)
    ).slice(0, 10);
  }

  onProductSearch(event: Event, i: number): void {
    this.productSearchTerms[i] = (event.target as HTMLInputElement).value;
    this.activeProductPicker.set(i);
  }

  openProductPicker(i: number): void {
    this.activeProductPicker.set(i);
  }

  closeProductPicker(): void {
    this.activeProductPicker.set(null);
  }

  pickProduct(i: number, p: Product): void {
    this.lineItems[i].productId = p.id;
    this.lineItems[i].articleNumber = p.articleNumber;
    this.lineItems[i].description = p.name;
    this.lineItems[i].unitPrice = Number(p.unitPrice);
    this.productSearchTerms[i] = '';
    this.activeProductPicker.set(null);
    this.recalcLine(i);
    this.cdr.detectChanges();
  }

  // ── Line items ──────────────────────────────────
  addLineItem(): void {
    this.lineItems.push({
      articleNumber: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
      discountPct: 0,
      lineTotal: 0,
    });
    this.productSearchTerms.push('');
  }

  removeLineItem(i: number): void {
    this.lineItems.splice(i, 1);
    this.productSearchTerms.splice(i, 1);
  }

  recalcLine(i: number): void {
    const item = this.lineItems[i];
    const gross = (item.unitPrice || 0) * (item.quantity || 0);
    const disc = gross * ((item.discountPct || 0) / 100);
    item.lineTotal = gross - disc;
  }

  recalcTotals(): void {
    // totals() is a computed signal — just trigger change detection
    this.cdr.detectChanges();
  }

  // ── Submit ──────────────────────────────────────
  submit(): void {
    const acct = this.selectedAccount();
    if (!acct || this.lineItems.length === 0) return;

    this.saving.set(true);
    this.error.set(null);

    const dto: CreateReceiptDto = {
      accountId: acct.id,
      issueDate: this.form.issueDate!,
      dueDate: this.form.dueDate || undefined,
      currency: this.form.currency || acct.defaultCurrency || 'USD',
      paymentTerms: this.form.paymentTerms || undefined,
      vatRate: this.form.vatRate || 0,
      notes: this.form.notes || undefined,
      lineItems: this.lineItems.map((item) => ({
        productId: item.productId,
        articleNumber: item.articleNumber,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPct: item.discountPct || 0,
      } as CreateReceiptLineItemDto)),
    };

    this.api.createReceipt(dto).subscribe({
      next: (receipt) => {
        this.saving.set(false);
        this.router.navigate(['/receipts', receipt.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message || 'Failed to create receipt.');
      },
    });
  }
}
