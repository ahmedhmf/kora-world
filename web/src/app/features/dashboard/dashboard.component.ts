import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SuppliersStore } from '../../store/suppliers.store';
import { ProductsStore } from '../../store/products.store';
import { PurchaseOrdersStore } from '../../store/purchase-orders.store';
import { SamplesStore } from '../../store/samples.store';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="p-8">
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-white">Dashboard</h1>
        <p class="text-zinc-400 text-sm mt-1">Welcome to Kora World</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <!-- Suppliers -->
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p class="text-zinc-400 text-sm mb-1">Suppliers</p>
          <p class="text-3xl font-bold text-white">{{ suppliersStore.totalSuppliers() }}</p>
          <a routerLink="/suppliers" class="text-zinc-500 text-xs hover:text-zinc-300 mt-2 inline-block">View all →</a>
        </div>

        <!-- Products -->
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p class="text-zinc-400 text-sm mb-1">Products</p>
          <p class="text-3xl font-bold text-white">{{ productsStore.totalProducts() }}</p>
          <a routerLink="/products" class="text-zinc-500 text-xs hover:text-zinc-300 mt-2 inline-block">View all →</a>
        </div>

        <!-- Samples -->
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p class="text-zinc-400 text-sm mb-1">Samples</p>
          <p class="text-3xl font-bold text-white">{{ samplesStore.totalSamples() }}</p>
          <a routerLink="/samples" class="text-zinc-500 text-xs hover:text-zinc-300 mt-2 inline-block">View all →</a>
        </div>

        <!-- Purchase Orders -->
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p class="text-zinc-400 text-sm mb-1">Purchase Orders</p>
          <p class="text-3xl font-bold text-white">{{ purchaseOrdersStore.totalOrders() }}</p>
          <a routerLink="/purchase-orders" class="text-zinc-500 text-xs hover:text-zinc-300 mt-2 inline-block">View all →</a>
        </div>
      </div>

      <!-- Incoming Shipments Section -->
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 class="text-lg font-bold text-white mb-4 flex items-center space-x-2">
          <span>🚢</span>
          <span>Incoming Shipments (On the Way)</span>
        </h2>

        @if (getShippedItems().length === 0) {
          <div class="text-center py-10 bg-zinc-950/20 border border-dashed border-zinc-800 rounded-lg">
            <p class="text-2xl mb-2">📦</p>
            <p class="text-zinc-500 text-sm">No active shipments currently on the way.</p>
          </div>
        } @else {
          <div class="border border-zinc-800 rounded-lg overflow-hidden">
            <table class="w-full text-sm text-left">
              <thead>
                <tr class="bg-zinc-950/40 border-b border-zinc-800 text-zinc-400 text-xs font-semibold uppercase">
                  <th class="px-6 py-3.5">Type</th>
                  <th class="px-6 py-3.5">Reference</th>
                  <th class="px-6 py-3.5">Supplier</th>
                  <th class="px-6 py-3.5">Shipping Details</th>
                  <th class="px-6 py-3.5">Expected Delivery</th>
                  <th class="px-6 py-3.5"></th>
                </tr>
              </thead>
              <tbody>
                @for (item of getShippedItems(); track item.id + '-' + item.type) {
                  <tr class="border-b border-zinc-800/50 hover:bg-zinc-805/20 text-zinc-300 transition-colors">
                    <!-- Type Badge -->
                    <td class="px-6 py-4">
                      @if (item.type === 'order') {
                        <span class="px-2 py-1 bg-emerald-950/50 text-emerald-400 border border-emerald-900/30 rounded text-xs font-medium inline-flex items-center space-x-1">
                          <span>📦</span>
                          <span>Order</span>
                        </span>
                      } @else {
                        <span class="px-2 py-1 bg-blue-950/50 text-blue-400 border border-blue-900/30 rounded text-xs font-medium inline-flex items-center space-x-1">
                          <span>🧪</span>
                          <span>Sample</span>
                        </span>
                      }
                    </td>
                    <!-- Reference -->
                    <td class="px-6 py-4 font-semibold text-white">
                      {{ item.name }}
                    </td>
                    <!-- Supplier -->
                    <td class="px-6 py-4 text-zinc-400">
                      {{ item.supplierName || '—' }}
                    </td>
                    <!-- Shipping Details -->
                    <td class="px-6 py-4">
                      @if (item.carrier || item.trackingNumber) {
                        <div>
                          <span class="text-xs text-zinc-500">Carrier:</span>
                          <span class="ml-1 text-white font-medium">{{ item.carrier || '—' }}</span>
                        </div>
                        @if (item.trackingNumber) {
                          <div class="mt-0.5 text-xs">
                            <span class="text-zinc-500">Tracking:</span>
                            <span class="ml-1 font-mono text-zinc-300 font-semibold">{{ item.trackingNumber }}</span>
                          </div>
                        }
                      } @else {
                        <span class="text-zinc-500 italic text-xs">No tracking details provided</span>
                      }
                    </td>
                    <!-- Expected Delivery -->
                    <td class="px-6 py-4">
                      @if (item.type === 'order' && item.expectedDelivery) {
                        <span class="text-zinc-300 font-medium">{{ item.expectedDelivery }}</span>
                      } @else {
                        <span class="text-zinc-500 italic text-xs">N/A</span>
                      }
                    </td>
                    <!-- Action Link -->
                    <td class="px-6 py-4 text-right">
                      @if (item.type === 'order') {
                        <a
                          [routerLink]="['/purchase-orders', item.id]"
                          class="text-zinc-400 hover:text-white text-xs underline"
                        >View Details</a>
                      } @else {
                        <a
                          [routerLink]="['/samples', item.id, 'edit']"
                          class="text-zinc-400 hover:text-white text-xs underline"
                        >Edit Details</a>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  readonly suppliersStore = inject(SuppliersStore);
  readonly productsStore = inject(ProductsStore);
  readonly samplesStore = inject(SamplesStore);
  readonly purchaseOrdersStore = inject(PurchaseOrdersStore);

  ngOnInit(): void {
    this.suppliersStore.loadSuppliers();
    this.productsStore.loadProducts({});
    this.samplesStore.loadSamples();
    this.purchaseOrdersStore.loadPurchaseOrders();
  }

  getShippedItems(): any[] {
    const shippedOrders = this.purchaseOrdersStore.purchaseOrders()
      .filter((o: any) => o.status === 'shipped')
      .map((o: any) => ({
        id: o.id,
        type: 'order',
        name: o.poNumber,
        supplierName: o.supplier?.name || '',
        carrier: o.carrier,
        trackingNumber: o.trackingNumber,
        expectedDelivery: o.expectedDelivery ? new Date(o.expectedDelivery).toLocaleDateString() : '',
      }));

    const shippedSamples = this.samplesStore.samples()
      .filter((p) => p.status === 'shipped')
      .map((p) => ({
        id: p.id,
        type: 'sample',
        name: p.name,
        supplierName: p.supplier?.name || '',
        carrier: p.carrier,
        trackingNumber: p.trackingNumber,
        expectedDelivery: '',
      }));

    return [...shippedOrders, ...shippedSamples];
  }
}
