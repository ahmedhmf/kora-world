import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingStore } from '../../store/accounting.store';
import { SuppliersStore } from '../../store/suppliers.store';
import { PurchaseOrdersStore } from '../../store/purchase-orders.store';
import { Invoice, InvoiceLine } from '../../core/services/accounting-api.service';

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
          <!-- Type Filter -->
          <div class="flex flex-col gap-1">
            <label class="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Type</label>
            <select 
              [(ngModel)]="filterType"
              class="bg-zinc-950 border border-zinc-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-700 w-36"
            >
              <option value="all">All Types</option>
              <option value="incoming">Incoming (Supplier)</option>
              <option value="outgoing">Outgoing (Customer)</option>
            </select>
          </div>

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
              <option value="partially_paid">Partially Paid</option>
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
                <th class="p-4">Type</th>
                <th class="p-4">Supplier / Customer</th>
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
                  <td class="p-4">
                    <span 
                      [class]="inv.type === 'incoming' ? 'bg-amber-950/20 text-amber-400 border-amber-800/40' : 'bg-blue-950/20 text-blue-400 border-blue-800/40'" 
                      class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border"
                    >
                      {{ inv.type }}
                    </span>
                  </td>
                  <td class="p-4">
                    @if (inv.type === 'incoming') {
                      <div class="font-semibold text-white">{{ inv.supplier?.name || 'Unknown Supplier' }}</div>
                    } @else {
                      <div class="font-semibold text-white">{{ inv.customerName || 'Unknown Customer' }}</div>
                    }
                  </td>
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
                  <td colspan="8" class="p-10 text-center text-zinc-500 font-medium">
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
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-zinc-400">Invoice Number</label>
                  <input 
                    type="text" 
                    [(ngModel)]="formInvoice.number" 
                    class="w-full bg-zinc-950 border border-zinc-850 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-700"
                    placeholder="INV-2026-0001"
                  />
                </div>

                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-zinc-400">Invoice Type</label>
                  <select 
                    [(ngModel)]="formInvoice.type" 
                    class="w-full bg-zinc-950 border border-zinc-850 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-700"
                  >
                    <option value="incoming">Incoming (Supplier)</option>
                    <option value="outgoing">Outgoing (Customer)</option>
                  </select>
                </div>

                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-zinc-400">Currency</label>
                  <select 
                    [(ngModel)]="formInvoice.currency" 
                    class="w-full bg-zinc-950 border border-zinc-850 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-700 font-bold"
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

              <!-- Supplier / Customer Logic -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-zinc-900 pt-4">
                @if (formInvoice.type === 'incoming') {
                  <div class="space-y-1.5">
                    <label class="block text-xs font-medium text-zinc-400">Supplier</label>
                    <select 
                      [(ngModel)]="formInvoice.supplierId" 
                      class="w-full bg-zinc-950 border border-zinc-850 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-700"
                    >
                      <option [ngValue]="null">Select Supplier...</option>
                      @for (s of suppliersStore.suppliers(); track s.id) {
                        <option [ngValue]="s.id">{{ s.name }}</option>
                      }
                    </select>
                  </div>
                  <div class="space-y-1.5">
                    <label class="block text-xs font-medium text-zinc-400">Purchase Order Link (Optional)</label>
                    <select 
                      [(ngModel)]="formInvoice.poId" 
                      class="w-full bg-zinc-950 border border-zinc-850 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-700"
                    >
                      <option [ngValue]="null">None</option>
                      @for (po of poStore.purchaseOrders(); track po.id) {
                        <option [ngValue]="po.id">PO #{{ po.poNumber }} ({{ po.supplier?.name }})</option>
                      }
                    </select>
                  </div>
                } @else {
                  <div class="space-y-1.5 col-span-2">
                    <label class="block text-xs font-medium text-zinc-400">Customer Name</label>
                    <input 
                      type="text" 
                      [(ngModel)]="formInvoice.customerName" 
                      class="w-full bg-zinc-950 border border-zinc-850 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-700"
                      placeholder="e.g. Acme Corp"
                    />
                  </div>
                }
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

                <div class="space-y-2">
                  @for (line of formInvoice.lines; track $index; let idx = $index) {
                    <div class="grid grid-cols-12 gap-3 items-center bg-zinc-950 border border-zinc-900 p-2 rounded-lg">
                      <div class="col-span-6">
                        <input 
                          type="text" 
                          [(ngModel)]="line.description" 
                          placeholder="Description"
                          class="w-full bg-zinc-950 border border-zinc-850 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-700"
                        />
                      </div>
                      <div class="col-span-2">
                        <input 
                          type="number" 
                          [(ngModel)]="line.quantity" 
                          placeholder="Qty"
                          class="w-full bg-zinc-950 border border-zinc-850 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-700 text-right font-mono"
                        />
                      </div>
                      <div class="col-span-3">
                        <input 
                          type="number" 
                          [(ngModel)]="line.unitPrice" 
                          placeholder="Unit Price"
                          class="w-full bg-zinc-950 border border-zinc-850 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-700 text-right font-mono"
                        />
                      </div>
                      <div class="col-span-1 text-center">
                        <button 
                          (click)="removeLine(idx)"
                          class="text-zinc-650 hover:text-red-400 font-bold cursor-pointer transition-colors"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="px-6 py-4 border-t border-zinc-800 bg-zinc-950 flex justify-between items-center shrink-0">
              <!-- Subtotals -->
              <div class="flex flex-col gap-1 text-xs font-mono text-zinc-400">
                <div>Subtotal: <span class="text-white font-bold">{{ calculatedInvoiceTotals().subtotal | number:'1.2-2' }}</span></div>
                <div class="flex items-center gap-2">
                  <span>Tax Amount:</span>
                  <input 
                    type="number" 
                    [(ngModel)]="formInvoice.tax" 
                    class="bg-zinc-950 border border-zinc-850 rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none w-20 text-right font-mono"
                  />
                </div>
                <div>Total: <span class="text-white font-bold">{{ calculatedInvoiceTotals().total | number:'1.2-2' }}</span></div>
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
                  [disabled]="!formInvoice.number || formInvoice.lines.length === 0"
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

  filterType = signal<string>('all');
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
    currency: 'EUR',
    tax: 0,
    poId: null as number | null,
    lines: [] as InvoiceLine[]
  };

  ngOnInit() {
    this.store.loadInvoices();
    this.suppliersStore.loadSuppliers();
    this.poStore.loadPurchaseOrders();
  }

  filteredInvoices = computed(() => {
    let list = this.store.invoices();
    const type = this.filterType();
    const status = this.filterStatus();
    const q = this.searchQuery().trim().toLowerCase();

    if (type !== 'all') {
      list = list.filter(i => i.type === type);
    }
    if (status !== 'all') {
      list = list.filter(i => i.status === status);
    }
    if (q) {
      list = list.filter(i => 
        i.number.toLowerCase().includes(q) ||
        (i.customerName && i.customerName.toLowerCase().includes(q)) ||
        (i.supplier && i.supplier.name.toLowerCase().includes(q))
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
      type: 'incoming',
      supplierId: null,
      customerName: '',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      status: 'draft',
      currency: 'EUR',
      tax: 0,
      poId: null,
      lines: [
        { description: '', quantity: 1, unitPrice: 0 }
      ]
    };
    this.isFormModalOpen.set(true);
  }

  openEditModal(inv: Invoice) {
    this.editingId.set(inv.id);
    this.formInvoice = {
      number: inv.number,
      type: inv.type,
      supplierId: inv.supplierId || null,
      customerName: inv.customerName || '',
      date: new Date(inv.date).toISOString().split('T')[0],
      dueDate: new Date(inv.dueDate).toISOString().split('T')[0],
      status: inv.status,
      currency: inv.currency,
      tax: inv.tax,
      poId: inv.poId || null,
      lines: inv.lines.map(l => ({
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice)
      }))
    };
    this.isFormModalOpen.set(true);
  }

  addNewLine() {
    this.formInvoice.lines.push({
      description: '',
      quantity: 1,
      unitPrice: 0
    });
  }

  removeLine(idx: number) {
    this.formInvoice.lines.splice(idx, 1);
  }

  calculatedInvoiceTotals = computed(() => {
    let subtotal = 0;
    for (const l of this.formInvoice.lines) {
      subtotal += (l.quantity || 0) * (l.unitPrice || 0);
    }
    const tax = this.formInvoice.tax || 0;
    return {
      subtotal,
      tax,
      total: subtotal + tax
    };
  });

  submitForm() {
    const id = this.editingId();
    const dto = {
      ...this.formInvoice,
      supplierId: this.formInvoice.supplierId ? Number(this.formInvoice.supplierId) : null,
      poId: this.formInvoice.poId ? Number(this.formInvoice.poId) : null,
      tax: Number(this.formInvoice.tax)
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
