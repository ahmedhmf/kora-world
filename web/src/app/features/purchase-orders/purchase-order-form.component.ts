import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { PurchaseOrdersStore } from '../../store/purchase-orders.store';
import { SuppliersStore } from '../../store/suppliers.store';
import { ProductsStore } from '../../store/products.store';
import { ApiService } from '../../core/services/api.service';
import { CreatePurchaseOrderDto, POStatus } from '../../core/models/purchase-order.model';
import { DialogService } from '../../core/services/dialog.service';

@Component({
  selector: 'app-purchase-order-form',
  standalone: true,
  imports: [FormsModule, RouterLink, DecimalPipe],
  templateUrl: './purchase-order-form.component.html',
})
export class PurchaseOrderFormComponent implements OnInit {
  readonly store = inject(PurchaseOrdersStore);
  readonly suppliersStore = inject(SuppliersStore);
  readonly productsStore = inject(ProductsStore);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogService = inject(DialogService);

  readonly isEdit = signal(false);
  private editId = signal<number | null>(null);

  supplierName = '';
  previousSupplierId = 0;
  lineItems: { productId: number; quantity: number }[] = [];
  readOnlyLineItems: any[] = [];
  poTotalValue = 0;
  poShippingCost = 0;

  form: any = {
    supplierId: 0,
    orderDate: new Date().toISOString().slice(0, 10),
    expectedDelivery: '',
    status: 'draft',
    notes: '',
    currency: 'USD',
    carrier: '',
    trackingNumber: '',
  };

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.isEdit.set(true);
        this.editId.set(+id);
        forkJoin({
          suppliers: this.api.getSuppliers(),
          po: this.api.getPurchaseOrder(+id)
        }).subscribe({
          next: ({ suppliers, po }) => {
            this.suppliersStore.setSuppliers(suppliers);
            this.form = {
              supplierId: po.supplierId,
              orderDate: po.orderDate ? new Date(po.orderDate).toISOString().slice(0, 10) : '',
              expectedDelivery: po.expectedDelivery ? new Date(po.expectedDelivery).toISOString().slice(0, 10) : '',
              status: po.status,
              notes: po.notes || '',
              currency: po.currency || 'USD',
              carrier: po.carrier || '',
              trackingNumber: po.trackingNumber || '',
            };
            this.supplierName = po.supplier?.name || '';
            this.readOnlyLineItems = po.lineItems || [];
            this.poTotalValue = po.totalValue || 0;
            this.poShippingCost = po.shippingCost || 0;
            this.cdr.detectChanges();
          },
          error: (err) => console.error('PurchaseOrderForm: error loading data:', err)
        });
      } else {
        this.isEdit.set(false);
        this.editId.set(null);
        this.form = {
          supplierId: 0,
          orderDate: new Date().toISOString().slice(0, 10),
          expectedDelivery: '',
          status: 'draft',
          notes: '',
          currency: 'USD',
          carrier: '',
          trackingNumber: '',
        };
        this.supplierName = '';
        this.readOnlyLineItems = [];
        this.lineItems = [];
        this.poTotalValue = 0;
        this.poShippingCost = 0;

        this.api.getSuppliers().subscribe({
          next: (suppliers) => {
            this.suppliersStore.setSuppliers(suppliers);
            this.cdr.detectChanges();
          },
          error: (err) => console.error('PurchaseOrderForm: error loading suppliers:', err)
        });
      }
    });
  }

  async onSupplierChange(): Promise<void> {
    if (this.lineItems.length > 0) {
      const ok = await this.dialogService.confirm('Clear Line Items', 'Changing the supplier will clear your current line items. Proceed?');
      if (ok) {
        this.lineItems = [];
      } else {
        this.form.supplierId = this.previousSupplierId;
        return;
      }
    }
    this.previousSupplierId = this.form.supplierId;
    this.productsStore.loadProducts({ supplierId: this.form.supplierId || undefined });

    // Pre-fill expectedDelivery date based on supplier leadTimeDays
    const supplier = this.suppliersStore.suppliers().find((s) => s.id === this.form.supplierId);
    if (supplier && supplier.leadTimeDays && this.form.orderDate) {
      const orderDate = new Date(this.form.orderDate);
      const deliveryDate = new Date(orderDate.getTime() + supplier.leadTimeDays * 24 * 60 * 60 * 1000);
      this.form.expectedDelivery = deliveryDate.toISOString().slice(0, 10);
    } else {
      this.form.expectedDelivery = '';
    }
  }

  onOrderDateChange(): void {
    const supplier = this.suppliersStore.suppliers().find((s) => s.id === this.form.supplierId);
    if (supplier && supplier.leadTimeDays && this.form.orderDate) {
      const orderDate = new Date(this.form.orderDate);
      const deliveryDate = new Date(orderDate.getTime() + supplier.leadTimeDays * 24 * 60 * 60 * 1000);
      this.form.expectedDelivery = deliveryDate.toISOString().slice(0, 10);
    }
  }

  addLineItem(): void {
    this.lineItems.push({ productId: 0, quantity: 1 });
  }

  removeLineItem(index: number): void {
    this.lineItems.splice(index, 1);
  }

  getProductPrice(productId: number): number {
    const product = this.productsStore.products().find((p) => p.id === productId);
    return product ? Number(product.unitPrice) : 0;
  }

  get poCurrency(): string {
    const supplier = this.suppliersStore.suppliers().find((s) => s.id === this.form.supplierId);
    return supplier ? supplier.currency || 'USD' : 'USD';
  }

  get totalPOValue(): number {
    return this.lineItems.reduce((sum, item) => {
      return sum + this.getProductPrice(item.productId) * item.quantity;
    }, 0);
  }

  get poItemsSubtotal(): number {
    return this.readOnlyLineItems.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  }

  getProductWeight(productId: number): number {
    const product = this.productsStore.products().find((p) => p.id === productId);
    return product ? Number(product.weightKg || 0) : 0;
  }

  get totalOrderWeight(): number {
    return this.lineItems.reduce((sum, item) => {
      return sum + (this.getProductWeight(item.productId) * item.quantity);
    }, 0);
  }

  get supplierShippingRate(): number {
    const supplier = this.suppliersStore.suppliers().find((s) => s.id === this.form.supplierId);
    return supplier ? Number(supplier.shippingRatePerKg || 0) : 0;
  }

  get estimatedShippingCost(): number {
    return this.totalOrderWeight * this.supplierShippingRate;
  }

  submit(): void {
    if (!this.isEdit()) {
      if (!this.form.supplierId || !this.form.orderDate || this.lineItems.length === 0) return;
      
      const payload: CreatePurchaseOrderDto = {
        supplierId: this.form.supplierId,
        orderDate: this.form.orderDate,
        expectedDelivery: this.form.expectedDelivery || undefined,
        notes: this.form.notes || undefined,
        lineItems: this.lineItems.filter((i) => i.productId > 0),
      };

      this.store.createPurchaseOrder(payload);
    } else {
      const payload: any = {
        status: this.form.status,
        notes: this.form.notes || undefined,
        expectedDelivery: this.form.expectedDelivery || undefined,
        carrier: this.form.carrier || undefined,
        trackingNumber: this.form.trackingNumber || undefined,
      };

      this.store.updatePurchaseOrder({ id: this.editId()!, dto: payload });
    }

    this.router.navigate(['/purchase-orders']);
  }
}
