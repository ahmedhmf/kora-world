import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingStore } from '../../store/accounting.store';
import { SuppliersStore } from '../../store/suppliers.store';
import { PurchaseOrdersStore } from '../../store/purchase-orders.store';
import { ProductsStore } from '../../store/products.store';
import { Invoice, InvoiceLine, AccountingApiService } from '../../core/services/accounting-api.service';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-8 max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white">Invoices</h1>
          <p class="text-zinc-400 text-sm mt-1">Record supplier invoices (incoming) or issue customer invoices (outgoing).</p>
        </div>
        <button
          (click)="openCreateModal()"
          class="px-5 py-2.5 bg-white text-zinc-900 hover:bg-zinc-100 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
          </svg>
          Record Invoice
        </button>
      </div>

      <!-- Filters -->
      <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div class="flex flex-wrap gap-3 items-center">
          <!-- Status Filter -->
          <div class="flex flex-col gap-1">
            <label class="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Status</label>
            <select
              [(ngModel)]="filterStatus"
              class="bg-zinc-950 border border-zinc-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-700 w-36"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <!-- Search -->
        <div class="relative w-full md:w-72">
          <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search by invoice # or customer..."
            class="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-850 text-white rounded-lg focus:outline-none focus:border-zinc-700 text-xs placeholder-zinc-650"
          />
        </div>
      </div>

      <!-- Invoices Table -->
      <div class="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-zinc-900/60 border-b border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px] font-semibold">
                <th class="p-4">Invoice #</th>
                <th class="p-4">Customer</th>
                <th class="p-4">Date</th>
                <th class="p-4">Due Date</th>
                <th class="p-4 text-right">Total</th>
                <th class="p-4 text-center">Status</th>
                <th class="p-4 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-900">
              @for (inv of filteredInvoices(); track inv.id) {
                <tr class="hover:bg-zinc-900/35 transition-colors">
                  <td class="p-4 font-mono font-bold text-zinc-300">{{ inv.number }}</td>
                  <td class="p-4 font-semibold text-white">{{ inv.customerName || '—' }}</td>
                  <td class="p-4 text-zinc-300">{{ inv.date | date:'dd MMM yyyy' }}</td>
                  <td class="p-4 text-zinc-300">{{ inv.dueDate | date:'dd MMM yyyy' }}</td>
                  <td class="p-4 text-right font-mono font-bold text-zinc-100">
                    {{ inv.total | currency: inv.currency:'symbol':'1.2-2' }}
                  </td>
                  <td class="p-4 text-center">
                    <span [class]="getStatusClass(inv.status)" class="px-2.5 py-1 rounded-full text-[10px] font-bold border">
                      {{ inv.status }}
                    </span>
                  </td>
                  <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                      <button
                        (click)="openEditModal(inv)"
                        class="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded transition-colors cursor-pointer"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        (click)="deleteInvoice(inv.id)"
                        class="p-1.5 bg-zinc-900 hover:bg-red-950/40 text-zinc-300 hover:text-red-400 rounded transition-colors cursor-pointer"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="p-10 text-center text-zinc-500 font-medium">
                    No invoices found.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Create/Edit Modal -->
      @if (isFormModalOpen()) {
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-black border border-zinc-800 rounded-xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <!-- Modal Header -->
            <div class="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950 shrink-0">
              <h3 class="font-bold text-white text-base">
                {{ editingId() ? '✏️ Edit Invoice' : '🧾 Record Invoice' }}
              </h3>
              <button (click)="isFormModalOpen.set(false)" class="text-zinc-500 hover:text-white text-lg font-bold transition-colors cursor-pointer focus:outline-none">&times;</button>
            </div>
            
            <!-- Modal Body -->
            <div class="p-6 space-y-4 overflow-y-auto flex-1">
              @if (store.error()) {
                <div class="p-3 bg-red-950/40 border border-red-900/60 rounded-lg text-xs text-red-400 font-medium flex items-start gap-2">
                  <span class="text-sm">⚠️</span>
                  <div class="flex-1">
                    <div class="font-bold">Could not save invoice</div>
                    <div class="text-[11px] opacity-90 mt-0.5">{{ store.error() }}</div>
                  </div>
                </div>
              }

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-zinc-400">Invoice Number</label>
                  <div class="bg-zinc-950 border border-zinc-900 rounded px-3 py-2 text-sm font-mono text-zinc-300 flex items-center justify-between min-h-[38px]">
                    @if (numberLoading()) {
                      <span class="text-zinc-500 text-xs animate-pulse flex items-center gap-1.5">
                        <span class="inline-block w-3 h-3 border border-t-transparent border-zinc-500 rounded-full animate-spin"></span>
                        Generating...
                      </span>
                    } @else {
                      <span>{{ formInvoice.number || 'Generating on Save...' }}</span>
                      <span class="text-zinc-655 text-[10px] select-none font-semibold" title="Auto-generated, not editable">🔒 Auto-generated</span>
                    }
                  </div>
                </div>

                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-zinc-400">Currency</label>
                  <select
                    [(ngModel)]="formInvoice.currency"
                    (change)="onCurrencyChange()"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600 font-bold"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="EGP">EGP</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-zinc-400">Invoice Date</label>
                  <input 
                    type="date" 
                    [(ngModel)]="formInvoice.date" 
                    class="w-full bg-zinc-950 border border-zinc-850 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-700"
                  />
                </div>

                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-zinc-400">Due Date</label>
                  <input 
                    type="date" 
                    [(ngModel)]="formInvoice.dueDate" 
                    class="w-full bg-zinc-950 border border-zinc-850 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-700"
                  />
                </div>

                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-zinc-400">Status</label>
                  <select 
                    [(ngModel)]="formInvoice.status" 
                    class="w-full bg-zinc-950 border border-zinc-850 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-700"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <!-- Customer -->
              <div class="border-t border-zinc-900 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-zinc-400">Customer Name *</label>
                  <input
                    type="text"
                    [(ngModel)]="formInvoice.customerName"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600"
                    placeholder="e.g. Acme Corp"
                  />
                </div>
              </div>

              <!-- Invoice Lines -->
              <div class="border-t border-zinc-900 pt-4">
                <div class="flex items-center justify-between mb-3">
                  <h4 class="text-xs font-bold text-zinc-300 uppercase tracking-wider">Line Items</h4>
                  <button
                    (click)="addNewLine()"
                    class="px-2.5 py-1 bg-zinc-900 text-zinc-300 border border-zinc-800 hover:text-white hover:border-zinc-700 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    + Add Line
                  </button>
                </div>

                <!-- Column headers -->
                <div class="grid grid-cols-12 gap-2 mb-1 px-1">
                  <div class="col-span-4 text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Product</div>
                  <div class="col-span-3 text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Description</div>
                  <div class="col-span-2 text-[10px] text-zinc-600 uppercase tracking-wider font-semibold text-right">Qty</div>
                  <div class="col-span-2 text-[10px] text-zinc-600 uppercase tracking-wider font-semibold text-right">Unit Price</div>
                  <div class="col-span-1"></div>
                </div>

                <div class="space-y-2">
                  @for (line of formInvoice.lines; track $index; let idx = $index) {
                    <div class="grid grid-cols-12 gap-2 items-center bg-zinc-950 border border-zinc-900 p-2 rounded-lg">
                      <!-- Product dropdown -->
                      <div class="col-span-4">
                        <select
                          [ngModel]="line.productId"
                          (change)="selectProductForLine(idx, +$any($event.target).value)"
                          class="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-600"
                        >
                          <option [ngValue]="undefined">— choose product —</option>
                          @for (p of productsStore.products(); track p.id) {
                            <option [value]="p.id">{{ p.name }} ({{ p.articleNumber }})</option>
                          }
                        </select>
                      </div>
                      <!-- Description (editable override) -->
                      <div class="col-span-3">
                        <input
                          type="text"
                          [(ngModel)]="line.description"
                          placeholder="Description"
                          class="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-600"
                        />
                      </div>
                      <!-- Qty -->
                      <div class="col-span-2">
                        <input
                          type="number"
                          [(ngModel)]="line.quantity"
                          (ngModelChange)="onLineQtyChange(idx)"
                          min="1"
                          class="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-600 text-right font-mono"
                        />
                      </div>
                      <!-- Unit Price -->
                      <div class="col-span-2">
                        <input
                          type="number"
                          [(ngModel)]="line.unitPrice"
                          class="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-600 text-right font-mono"
                        />
                      </div>
                      <!-- Remove -->
                      <div class="col-span-1 text-center">
                        <button
                          (click)="removeLine(idx)"
                          class="text-zinc-600 hover:text-red-400 font-bold cursor-pointer transition-colors text-base leading-none"
                        >&times;</button>
                      </div>

                      <!-- Inline price tier / currency details -->
                      @if (line.productId) {
                        <div class="col-span-12 px-1 pt-1 border-t border-zinc-900/60 flex items-center justify-between text-[10px] text-zinc-500">
                          <div>
                            Product Currency: <span class="text-zinc-400 font-bold font-mono">{{ getProductCurrency(line.productId) }}</span>
                            @if (getProductMOQ(line.productId) > 0) {
                              | MOQ: <span class="text-zinc-400 font-bold font-mono">{{ getProductMOQ(line.productId) }}</span>
                            }
                          </div>
                          <div class="flex items-center gap-1.5">
                            <span class="text-zinc-500">Tier:</span>
                            <span class="px-1.5 py-0.5 rounded font-semibold text-[9px]"
                              [ngClass]="getTierClass(line.productId, line.quantity)">
                              {{ getActiveTierName(line.productId, line.quantity) }}
                            </span>
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="px-6 py-4 border-t border-zinc-800 bg-zinc-950 flex justify-between items-center shrink-0">
              <!-- Subtotals -->
              <div class="bg-zinc-950 border border-zinc-900 rounded-lg p-3 space-y-2 text-xs font-mono text-zinc-400 w-80">
                <div class="flex justify-between">
                  <span>Gross Subtotal:</span>
                  <span class="text-white font-bold">{{ calculatedInvoiceTotals().subtotalBeforeDiscount | number:'1.2-2' }}</span>
                </div>
                
                <div class="flex items-center justify-between gap-4">
                  <span class="flex items-center gap-1.5">Discount:
                    <input 
                      type="number" 
                      [(ngModel)]="formInvoice.discountRate" 
                      min="0"
                      max="100"
                      class="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none w-14 text-right font-mono font-bold"
                    />
                    %
                  </span>
                  <span class="text-red-400 font-bold">-{{ calculatedInvoiceTotals().discount | number:'1.2-2' }}</span>
                </div>

                <div class="flex justify-between border-t border-zinc-900/60 pt-2">
                  <span>Net Subtotal:</span>
                  <span class="text-white font-bold">{{ calculatedInvoiceTotals().subtotal | number:'1.2-2' }}</span>
                </div>

                <div class="flex items-center justify-between gap-4">
                  <span class="flex items-center gap-1.5">Tax Rate:
                    <input 
                      type="number" 
                      [(ngModel)]="formInvoice.taxRate" 
                      min="0"
                      class="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none w-14 text-right font-mono font-bold"
                    />
                    %
                  </span>
                  <span class="text-emerald-400 font-bold">+{{ calculatedInvoiceTotals().tax | number:'1.2-2' }}</span>
                </div>

                <div class="flex justify-between border-t border-zinc-800 pt-2 text-sm">
                  <span class="text-zinc-200 font-semibold">Total ({{ formInvoice.currency }}):</span>
                  <span class="text-white font-bold text-base">{{ calculatedInvoiceTotals().total | number:'1.2-2' }}</span>
                </div>
              </div>

              <div class="flex gap-3">
                <button 
                  (click)="isFormModalOpen.set(false)" 
                  class="px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-white rounded text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  (click)="submitForm()" 
                  [disabled]="formInvoice.lines.length === 0"
                  class="px-4 py-2 bg-white hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-white text-zinc-900 rounded font-semibold text-xs transition-colors cursor-pointer"
                >
                  Save Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class InvoicesComponent implements OnInit {
  readonly store = inject(AccountingStore);
  readonly suppliersStore = inject(SuppliersStore);
  readonly poStore = inject(PurchaseOrdersStore);
  readonly productsStore = inject(ProductsStore);
  readonly accountingApi = inject(AccountingApiService);
  readonly apiService = inject(ApiService);

  numberLoading = signal(false);

  filterStatus = signal<string>('all');
  searchQuery = signal<string>('');

  isFormModalOpen = signal(false);
  editingId = signal<number | null>(null);

  formInvoice = {
    number: '',
    type: 'incoming' as 'incoming' | 'outgoing',
    supplierId: null as number | null,
    customerName: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    status: 'draft',
    currency: 'EGP',
    tax: 0,
    taxRate: 0,
    discountRate: 0,
    poId: null as number | null,
    lines: [] as (InvoiceLine & { productId?: number })[]
  };

  ngOnInit() {
    this.store.loadInvoices();
    this.suppliersStore.loadSuppliers();
    this.poStore.loadPurchaseOrders();
    this.productsStore.loadProducts({});
  }

  filteredInvoices = computed(() => {
    let list = this.store.invoices();
    const status = this.filterStatus();
    const q = this.searchQuery().trim().toLowerCase();

    if (status !== 'all') {
      list = list.filter(i => i.status === status);
    }
    if (q) {
      list = list.filter(i =>
        i.number.toLowerCase().includes(q) ||
        (i.customerName && i.customerName.toLowerCase().includes(q))
      );
    }

    return list;
  });

  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'paid':           return 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60';
      case 'sent':           return 'bg-blue-950/40 text-blue-400 border-blue-800/60';
      case 'partially_paid': return 'bg-purple-950/40 text-purple-400 border-purple-800/60';
      case 'draft':          return 'bg-zinc-800/50 text-zinc-400 border-zinc-700/60';
      case 'overdue':        return 'bg-red-950/40 text-red-400 border-red-800/60';
      case 'cancelled':      return 'bg-zinc-900/50 text-zinc-650 border-zinc-800/60';
      default:               return 'bg-zinc-800/50 text-zinc-400 border-zinc-700/60';
    }
  }

  openCreateModal() {
    this.editingId.set(null);
    this.formInvoice = {
      number: '',
      type: 'outgoing',
      supplierId: null,
      customerName: '',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      status: 'draft',
      currency: 'EGP',
      tax: 0,
      taxRate: 0,
      discountRate: 0,
      poId: null,
      lines: [{ description: '', quantity: 1, unitPrice: 0, productId: undefined }]
    };
    this.isFormModalOpen.set(true);
    // Auto-fetch next invoice number
    this.numberLoading.set(true);
    this.accountingApi.getNextInvoiceNumber().subscribe({
      next: (res) => {
        this.formInvoice.number = res.number;
        this.numberLoading.set(false);
      },
      error: () => this.numberLoading.set(false),
    });
  }

  /** When a PO is selected on an incoming invoice, fetch the full PO (with lineItems) and pre-fill */
  onPoChange() {
    if (!this.formInvoice.poId || this.formInvoice.type !== 'incoming') return;
    const poId = Number(this.formInvoice.poId);

    // The store's purchaseOrders list doesn't include lineItems (list endpoint omits them).
    // Fetch the full PO via the detail endpoint which does include lineItems.
    this.apiService.getPurchaseOrder(poId).subscribe({
      next: (po) => {
        // Set supplier from PO
        if (po.supplierId) this.formInvoice.supplierId = po.supplierId;

        // Set currency from PO
        if (po.currency) this.formInvoice.currency = po.currency;

        // Map PO line items → invoice lines
        if (po.lineItems && po.lineItems.length > 0) {
          this.formInvoice.lines = po.lineItems.map(li => ({
            description: li.description || li.articleNumber || '',
            quantity: Number(li.quantity),
            unitPrice: Number(li.unitPrice),
          }));
        }
      },
      error: () => {
        // Silently fall back — user can still add lines manually
      },
    });
  }

  openEditModal(inv: Invoice) {
    this.editingId.set(inv.id);
    
    // Parse discount line out of the line items
    let discountRate = 0;
    const editableLines = inv.lines.filter(l => {
      const match = l.description.match(/Discount\s*\((\d+(?:\.\d+)?)\%\)/i);
      if (match) {
        discountRate = parseFloat(match[1]);
        return false; // exclude from normal list
      }
      return true;
    });

    const tax = Number(inv.tax || 0);
    const subtotal = Number(inv.subtotal || 0);
    const taxRate = subtotal > 0 ? Number(((tax / subtotal) * 100).toFixed(2)) : 0;

    this.formInvoice = {
      number: inv.number,
      type: 'outgoing',
      supplierId: null,
      customerName: inv.customerName || '',
      date: new Date(inv.date).toISOString().split('T')[0],
      dueDate: new Date(inv.dueDate).toISOString().split('T')[0],
      status: inv.status,
      currency: inv.currency || 'EGP',
      tax: tax,
      taxRate: taxRate,
      discountRate: discountRate,
      poId: inv.poId || null,
      lines: editableLines.map(l => ({
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        productId: undefined as number | undefined,
      }))
    };
    this.isFormModalOpen.set(true);
  }

  addNewLine() {
    this.formInvoice.lines.push({
      description: '',
      quantity: 1,
      unitPrice: 0,
      productId: undefined,
    });
  }

  /** Auto-fill description and unit price from selected product */
  selectProductForLine(idx: number, productId: number) {
    if (!productId) {
      this.formInvoice.lines[idx].productId = undefined;
      return;
    }
    const product = this.productsStore.products().find(p => p.id === productId);
    if (!product) return;
    this.formInvoice.lines[idx].productId = productId;
    this.formInvoice.lines[idx].description = product.name;
    this.recalculateLinePrice(idx);
  }

  onLineQtyChange(idx: number) {
    this.recalculateLinePrice(idx);
  }

  onCurrencyChange() {
    this.recalculateAllLines();
  }

  recalculateLinePrice(idx: number) {
    const line = this.formInvoice.lines[idx];
    if (!line || !line.productId) return;
    
    const product = this.productsStore.products().find(p => p.id === line.productId);
    if (!product) return;

    const qty = line.quantity || 1;
    const moq = product.moq || 0;

    let basePrice = 0;
    if (moq > 0 && qty >= moq) {
      basePrice = product.bulkPrice ?? product.onePcPrice ?? product.unitPrice ?? 0;
    } else if (qty < 50) {
      basePrice = product.onePcPrice ?? product.unitPrice ?? 0;
    } else {
      // Between 50 and MOQ: use onePcPrice, fall back to unitPrice
      basePrice = product.onePcPrice ?? product.unitPrice ?? 0;
    }

    const prodCurrency = (product.currency || 'EGP').toUpperCase();
    const invCurrency = (this.formInvoice.currency || 'EGP').toUpperCase();

    if (prodCurrency === invCurrency) {
      line.unitPrice = Number(basePrice.toFixed(2));
      return;
    }

    const date = this.formInvoice.date || new Date().toISOString().split('T')[0];
    this.accountingApi.getExchangeRate(prodCurrency, invCurrency, date).subscribe({
      next: (rate) => {
        line.unitPrice = Number((basePrice * rate).toFixed(2));
      },
      error: () => {
        // Fallback exchange rates mapping
        const fallbackRates: Record<string, Record<string, number>> = {
          EUR: { USD: 1.09, EGP: 52.0, EUR: 1.0 },
          USD: { EUR: 0.92, EGP: 48.0, USD: 1.0 },
          EGP: { EUR: 0.019, USD: 0.021, EGP: 1.0 }
        };
        const fromRates = fallbackRates[prodCurrency] || {};
        const rate = fromRates[invCurrency] || 1.0;
        line.unitPrice = Number((basePrice * rate).toFixed(2));
      }
    });
  }

  recalculateAllLines() {
    for (let i = 0; i < this.formInvoice.lines.length; i++) {
      this.recalculateLinePrice(i);
    }
  }

  getProductCurrency(productId?: number): string {
    if (!productId) return '';
    const p = this.productsStore.products().find(prod => prod.id === productId);
    return p?.currency || 'EGP';
  }

  getProductMOQ(productId?: number): number {
    if (!productId) return 0;
    const p = this.productsStore.products().find(prod => prod.id === productId);
    return p?.moq || 0;
  }

  getActiveTierName(productId?: number, qty?: number): string {
    if (!productId) return '';
    const p = this.productsStore.products().find(prod => prod.id === productId);
    if (!p) return '';
    const q = qty || 0;
    const moq = p.moq || 0;
    if (moq > 0 && q >= moq) return `Bulk Price (${p.bulkPrice || 0} ${p.currency || 'EGP'})`;
    if (q < 50) return `1 PC Price (${p.onePcPrice || 0} ${p.currency || 'EGP'})`;
    return `Standard Price (${p.onePcPrice || p.unitPrice || 0} ${p.currency || 'EGP'})`;
  }

  getTierClass(productId?: number, qty?: number): string {
    if (!productId) return '';
    const p = this.productsStore.products().find(prod => prod.id === productId);
    if (!p) return '';
    const q = qty || 0;
    const moq = p.moq || 0;
    if (moq > 0 && q >= moq) return 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/60';
    if (q < 50) return 'bg-blue-950/40 text-blue-400 border border-blue-900/60';
    return 'bg-zinc-900 text-zinc-400 border border-zinc-800';
  }

  removeLine(idx: number) {
    this.formInvoice.lines.splice(idx, 1);
  }

  calculatedInvoiceTotals() {
    let subtotalBeforeDiscount = 0;
    for (const l of this.formInvoice.lines) {
      subtotalBeforeDiscount += (l.quantity || 0) * (l.unitPrice || 0);
    }
    const discountRate = this.formInvoice.discountRate || 0;
    const discount = Number((subtotalBeforeDiscount * (discountRate / 100)).toFixed(2));
    const subtotal = Number((subtotalBeforeDiscount - discount).toFixed(2));
    
    const taxRate = this.formInvoice.taxRate || 0;
    const tax = Number((subtotal * (taxRate / 100)).toFixed(2));
    const total = Number((subtotal + tax).toFixed(2));

    return {
      subtotalBeforeDiscount,
      discount,
      subtotal,
      tax,
      total
    };
  }

  submitForm() {
    const id = this.editingId();
    const totals = this.calculatedInvoiceTotals();

    const linesToSend = this.formInvoice.lines.map(l => ({
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
    }));

    if (totals.discount > 0) {
      linesToSend.push({
        description: `Discount (${this.formInvoice.discountRate}%)`,
        quantity: 1,
        unitPrice: -totals.discount,
      });
    }

    const dto = {
      number: this.formInvoice.number?.trim() || undefined,
      type: this.formInvoice.type,
      date: this.formInvoice.date,
      dueDate: this.formInvoice.dueDate,
      status: this.formInvoice.status,
      currency: this.formInvoice.currency,
      tax: totals.tax,
      lines: linesToSend,
      supplierId: this.formInvoice.supplierId ? Number(this.formInvoice.supplierId) : undefined,
      poId: this.formInvoice.poId ? Number(this.formInvoice.poId) : undefined,
      customerName: this.formInvoice.customerName?.trim() || undefined,
    };

    if (id) {
      this.store.updateInvoice({
        id,
        dto,
        onSuccess: () => this.isFormModalOpen.set(false)
      });
    } else {
      this.store.createInvoice({
        dto,
        onSuccess: () => this.isFormModalOpen.set(false)
      });
    }
  }

  deleteInvoice(id: number) {
    if (confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      this.store.deleteInvoice(id);
    }
  }
}
