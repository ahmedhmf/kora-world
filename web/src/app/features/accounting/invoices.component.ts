import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingStore } from '../../store/accounting.store';
import { SuppliersStore } from '../../store/suppliers.store';
import { PurchaseOrdersStore } from '../../store/purchase-orders.store';
import { ProductsStore } from '../../store/products.store';
import { Invoice, InvoiceLine, AccountingApiService } from '../../core/services/accounting-api.service';
import { ApiService } from '../../core/services/api.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './invoices.component.html',
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
