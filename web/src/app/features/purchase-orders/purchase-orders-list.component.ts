import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { PurchaseOrdersStore } from '../../store/purchase-orders.store';
import { DialogService } from '../../core/services/dialog.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-purchase-orders-list',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe],
  template: `
    <div class="p-8">

      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold text-white">Purchase Orders</h1>
          <p class="text-zinc-400 text-sm mt-1">{{ store.totalOrders() }} orders recorded</p>
        </div>
        @if (authService.currentUser()?.role !== 'supplier') {
          <a
            routerLink="/purchase-orders/new"
            class="px-4 py-2 bg-white text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-100 transition-colors"
          >
            + Add Purchase Order
          </a>
        }
      </div>

      <!-- Loading -->
      @if (store.loading()) {
        <div class="flex items-center justify-center py-20">
          <div class="w-6 h-6 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
        </div>
      }

      <!-- Error -->
      @if (store.error()) {
        <div class="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
          {{ store.error() }}
        </div>
      }

      <!-- Empty state -->
      @if (!store.loading() && store.purchaseOrders().length === 0) {
        <div class="text-center py-20">
          <p class="text-4xl mb-4">📋</p>
          <p class="text-zinc-400 text-sm">No purchase orders found.</p>
          @if (authService.currentUser()?.role !== 'supplier') {
            <a routerLink="/purchase-orders/new" class="text-white text-sm underline mt-2 inline-block">Create your first purchase order</a>
          }
        </div>
      }

      <!-- Table -->
      @if (!store.loading() && store.purchaseOrders().length > 0) {
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-zinc-800">
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">PO Number</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Supplier</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Order Date</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Expected Delivery</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Status</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Total Value</th>
                <th class="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              @for (po of store.purchaseOrders(); track po.id) {
                <tr class="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td class="px-6 py-4 font-mono font-medium text-white text-xs">{{ po.poNumber }}</td>
                  <td class="px-6 py-4 text-zinc-400">{{ po.supplier?.name ?? '—' }}</td>
                  <td class="px-6 py-4 text-zinc-400">{{ po.orderDate | date:'mediumDate' }}</td>
                  <td class="px-6 py-4 text-zinc-400">
                    {{ po.expectedDelivery ? (po.expectedDelivery | date:'mediumDate') : '—' }}
                  </td>
                  <td class="px-6 py-4">
                    <span class="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
                      [class]="statusClass(po.status)">
                      {{ po.status }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-white font-medium">
                    {{ po.totalValue | number:'1.2-2' }} {{ po.currency }}
                  </td>
                  <td class="px-6 py-4 text-right">
                    <a
                      [routerLink]="['/purchase-orders', po.id]"
                      class="text-zinc-400 hover:text-white text-xs underline mr-4"
                    >View</a>
                    @if (authService.currentUser()?.role !== 'supplier') {
                      <a
                        [routerLink]="['/purchase-orders', po.id, 'edit']"
                        class="text-zinc-400 hover:text-white text-xs underline mr-4"
                      >Edit</a>
                      <button
                        (click)="delete(po.id)"
                        class="text-red-400 hover:text-red-300 text-xs font-medium"
                      >Delete</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class PurchaseOrdersListComponent implements OnInit {
  readonly store = inject(PurchaseOrdersStore);
  readonly authService = inject(AuthService);
  private readonly dialogService = inject(DialogService);

  ngOnInit(): void {
    this.store.loadPurchaseOrders();
  }

  async delete(id: number): Promise<void> {
    const ok = await this.dialogService.confirm('Delete Purchase Order', 'Delete this purchase order? This action cannot be undone.');
    if (ok) {
      this.store.deletePurchaseOrder(id);
    }
  }

  statusClass(status: string): string {
    switch (status) {
      case 'draft': return 'bg-zinc-800 text-zinc-400 border border-zinc-700/30';
      case 'sent': return 'bg-amber-900/40 text-amber-400 border border-amber-800/30';
      case 'confirmed': return 'bg-blue-900/40 text-blue-400 border border-blue-800/30';
      case 'shipped': return 'bg-purple-900/40 text-purple-400 border border-purple-800/30';
      case 'received': return 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/30';
      case 'cancelled': return 'bg-red-950/60 text-red-400 border border-red-900/30';
      default: return 'bg-zinc-800 text-zinc-400';
    }
  }
}
