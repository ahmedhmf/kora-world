import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { PurchaseOrdersStore } from '../../store/purchase-orders.store';
import { POStatus } from '../../core/models/purchase-order.model';

@Component({
  selector: 'app-purchase-order-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe],
  template: `
    <div class="p-8 max-w-4xl print:p-0 print:max-w-full">

      <!-- Header & Navigation -->
      <div class="flex items-center justify-between mb-8 print:hidden">
        <div>
          <a routerLink="/purchase-orders" class="text-zinc-500 hover:text-zinc-300 text-sm mb-4 inline-block">← Back to Purchase Orders</a>
          <h1 class="text-2xl font-bold text-white flex items-center gap-3">
            <span>Order Details</span>
            @if (store.selectedPurchaseOrder(); as po) {
              <span class="text-xs font-mono font-normal text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded">
                {{ po.poNumber }}
              </span>
            }
          </h1>
        </div>
        <div class="flex gap-3">
          @if (store.selectedPurchaseOrder(); as po) {
            <button
              (click)="exportPdf()"
              class="px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-900 text-sm font-semibold rounded-lg transition-colors border border-zinc-200 cursor-pointer"
            >
              Export PDF
            </button>
            <a
              [routerLink]="['/purchase-orders', po.id, 'edit']"
              class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold rounded-lg transition-colors border border-zinc-700/50"
            >
              Edit Details
            </a>
          }
        </div>
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

      <!-- Document Sheet -->
      @if (!store.loading() && store.selectedPurchaseOrder(); as po) {
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl p-8 space-y-8 print:bg-white print:border-none print:shadow-none print:p-0 print:space-y-6 print:text-black">
          
          <!-- Document Header -->
          <div class="flex justify-between items-start border-b border-zinc-800 pb-6 print:border-zinc-300">
            <div>
              <div class="flex items-center mb-1">
                <svg width="150" height="32" viewBox="0 0 224 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="print:invert">
                  <g clip-path="url(#clip0_105_44)">
                    <path d="M69.71 15.16L65.85 27.04C65.16 29.17 66.75 31.36 68.99 31.36H93.17H97.19C98.8 31.36 100.23 30.32 100.73 28.79L106.39 11.37C106.81 10.08 105.85 8.75 104.49 8.75H78.53C74.51 8.75 70.95 11.34 69.71 15.16ZM73.35 24.88L75.6 17.84C76.11 16.25 77.58 15.18 79.25 15.18H96.57C97.48 15.18 98.13 16.07 97.85 16.94L95.28 24.89H73.36L73.35 24.88Z" fill="white" stroke="black" stroke-miterlimit="10"/>
                    <path d="M118.63 0.5L107.89 33.47C106.68 37.18 103.23 39.68 99.33 39.68L65.43 39.63C59.34 39.63 55.02 33.69 56.88 27.89L63.59 7.01C64.83 3.14 68.45 0.52 72.51 0.55L63.81 27.73C62.94 30.43 64.96 33.19 67.8 33.19H98.9C100.29 33.19 101.52 32.3 101.95 30.98L108.68 10.25C109.2 8.64 108 6.98 106.31 6.98L79.16 6.95C75.83 6.95 73.47 3.7 74.5 0.53V0.5H118.63Z" fill="white" stroke="black" stroke-miterlimit="10"/>
                    <path d="M130.53 0.550003C126.51 0.550003 122.94 3.14 121.7 6.97L111.12 39.61H117.84L130.53 0.550003Z" fill="white" stroke="black" stroke-miterlimit="10"/>
                    <path d="M155.55 0.5H132.48C131.45 3.67 133.81 6.92 137.14 6.92H155.65C157.36 6.92 158.56 8.59 158.03 10.21L153.21 24.95H159.97L164.09 12.28C165.98 6.47 161.65 0.51 155.54 0.51L155.55 0.5Z" fill="white" stroke="black" stroke-miterlimit="10"/>
                    <path d="M150.92 24.94L155.84 10.9C156.21 9.85001 155.43 8.74001 154.31 8.74001H136.55C132.53 8.74001 128.97 11.33 127.73 15.15L119.78 39.67L126.52 39.6L129.8 29.51L135.63 39.6H143.04L134.54 24.88H131.3L133.6 17.8C134.11 16.22 135.58 15.16 137.24 15.16H145.65C146.6 15.16 147.26 16.1 146.95 16.99L144.17 24.89H136.75L145.15 39.61H152.57L144.21 24.94H150.93H150.92Z" fill="white" stroke="black" stroke-miterlimit="10"/>
                    <path d="M179.75 0.550003L167.06 39.61H160.34L170.92 6.97C172.16 3.14 175.73 0.550003 179.75 0.550003Z" fill="white" stroke="black" stroke-miterlimit="10"/>
                    <path d="M176.97 15.16L169.01 39.68L175.7 39.75L182.84 17.81C183.35 16.23 184.82 15.17 186.48 15.17H203.41C204.55 15.17 205.35 16.28 205 17.36L202.52 24.95H184.74C182.99 24.95 181.44 26.08 180.89 27.74L179.7 31.37H200.42L197.69 39.73H204.45L213.43 12.22C213.99 10.51 212.72 8.75999 210.92 8.75999H185.79C181.77 8.75999 178.21 11.35 176.97 15.17V15.16Z" fill="white" stroke="black" stroke-miterlimit="10"/>
                    <path d="M206.39 39.68H213.1L222.15 11.64C223.93 6.14 219.82 0.5 214.04 0.5H181.83C180.8 3.67 183.16 6.92 186.49 6.92H211.21C214.08 6.92 216.11 9.72 215.23 12.44L206.39 39.68Z" fill="white" stroke="black" stroke-miterlimit="10"/>
                    <path d="M62.66 0.550003L47.02 13.67C44.5 15.78 43.86 19.4 45.51 22.25L55.53 39.6H48.16L38.69 23.28C36.2 18.99 37.16 13.54 40.96 10.35L52.68 0.550003H62.66Z" fill="white" stroke="black" stroke-miterlimit="10"/>
                    <path d="M46.04 39.68L39.06 27.59C35.89 22.1 28.54 20.81 23.69 24.88L15.54 31.72C13.56 33.38 10.64 31.41 11.44 28.95L20.66 0.550003H13.91L0.750025 41.07C-0.719975 45.6 4.65003 49.22 8.30003 46.16L25.05 32.1C28.28 29.39 33.18 30.26 35.28 33.92L38.58 39.67H46.03L46.04 39.68Z" fill="white" stroke="black" stroke-miterlimit="10"/>
                    <path d="M22.59 0.550003H29.34L26.86 8.19C26.44 9.48 27.97 10.52 29.01 9.64L39.84 0.550003H49.82L25.31 21.11C21.58 24.24 16.09 20.53 17.59 15.9L22.59 0.550003Z" fill="white" stroke="black" stroke-miterlimit="10"/>
                  </g>
                  <defs>
                    <clipPath id="clip0_105_44">
                      <rect width="223.08" height="47.8" fill="white"/>
                    </clipPath>
                  </defs>
                </svg>
              </div>
              <p class="text-xs text-zinc-500 print:text-zinc-500">Operations Hub</p>
              <p class="text-xs text-zinc-500 print:text-zinc-500">korafc.com</p>
            </div>
            
            <div class="text-right space-y-1">
              <span class="text-xs font-semibold uppercase tracking-wider text-zinc-500 print:text-zinc-500">Purchase Order</span>
              <p class="text-xl font-bold font-mono text-white print:text-black">{{ po.poNumber }}</p>
              <p class="text-xs text-zinc-400 print:text-zinc-600">Order Date: {{ po.orderDate | date:'mediumDate' }}</p>
              @if (po.expectedDelivery) {
                <p class="text-xs text-zinc-400 print:text-zinc-600">Expected Delivery: {{ po.expectedDelivery | date:'mediumDate' }}</p>
              }
            </div>
          </div>

          <!-- Parties Cards -->
          <div class="grid grid-cols-2 gap-6">
            <!-- Supplier Card -->
            <div class="bg-zinc-950/40 border border-zinc-800/80 rounded-lg p-5 space-y-3 print:bg-zinc-50 print:border-zinc-300">
              <span class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block print:text-zinc-500">Supplier Information</span>
              <div>
                <p class="text-white font-semibold text-sm print:text-black">{{ po.supplier?.name }}</p>
                <p class="text-zinc-400 text-xs print:text-zinc-700">{{ po.supplier?.country }}</p>
              </div>
              <div class="text-xs text-zinc-400 space-y-1 print:text-zinc-700">
                <p><span class="text-zinc-500 print:text-zinc-500">Contact:</span> {{ getPoContact(po.supplier)?.name || '—' }}</p>
                <p><span class="text-zinc-500 print:text-zinc-500">Email:</span> {{ getPoContact(po.supplier)?.email || '—' }}</p>
                <p><span class="text-zinc-500 print:text-zinc-500">Phone:</span> {{ getPoContact(po.supplier)?.phone || '—' }}</p>
              </div>
            </div>

            <!-- Meta / Status Card -->
            <div class="bg-zinc-950/40 border border-zinc-800/80 rounded-lg p-5 flex flex-col justify-between print:bg-zinc-50 print:border-zinc-300">
              <div class="space-y-3">
                <span class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block print:text-zinc-500">Status & Metadata</span>
                <div class="flex items-center gap-3">
                  <span class="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider print:border print:border-zinc-400 print:text-black print:bg-transparent"
                    [class]="statusClass(po.status)">
                    {{ po.status }}
                  </span>
                </div>
                <div class="text-xs text-zinc-400 space-y-1 print:text-zinc-700">
                  <p><span class="text-zinc-500 print:text-zinc-500">Currency:</span> {{ po.currency }}</p>
                  @if (po.supplier?.paymentTerms) {
                    <p><span class="text-zinc-500 print:text-zinc-500">Terms:</span> {{ po.supplier?.paymentTerms }}</p>
                  }
                </div>
              </div>

              <!-- Quick Status Selector -->
              <div class="flex items-center gap-2 pt-3 border-t border-zinc-800/50 mt-3 print:hidden">
                <span class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Update Status:</span>
                <select
                  [value]="po.status"
                  (change)="updateStatus($event)"
                  class="bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-zinc-500"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="shipped">Shipped</option>
                  <option value="received">Received</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Line Items Table -->
          <div class="border border-zinc-800 rounded-lg overflow-hidden print:border-zinc-300">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-zinc-950/60 border-b border-zinc-800 text-zinc-400 text-xs font-semibold uppercase print:bg-zinc-100 print:border-zinc-300 print:text-zinc-800">
                  <th class="text-left px-5 py-3.5">Article #</th>
                  <th class="text-left px-5 py-3.5">Description</th>
                  <th class="text-right px-5 py-3.5">Unit Price</th>
                  <th class="text-center px-5 py-3.5">Qty</th>
                  <th class="text-right px-5 py-3.5">Total</th>
                </tr>
              </thead>
              <tbody>
                @for (item of po.lineItems; track item.id) {
                  <tr class="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-950/20 transition-colors print:break-inside-avoid print:border-zinc-300">
                    <td class="px-5 py-3.5 font-mono text-zinc-400 text-xs print:text-zinc-700">{{ item.articleNumber }}</td>
                    <td class="px-5 py-3.5 text-white print:text-black">{{ item.description }}</td>
                    <td class="px-5 py-3.5 text-right text-zinc-300 print:text-zinc-800">
                      {{ item.unitPrice | number:'1.2-2' }} {{ po.currency }}
                    </td>
                    <td class="px-5 py-3.5 text-center text-white print:text-black">{{ item.quantity }}</td>
                    <td class="px-5 py-3.5 text-right font-medium text-white print:text-black">
                      {{ item.lineTotal | number:'1.2-2' }} {{ po.currency }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Footer summary -->
          <div class="flex justify-between items-start print:break-inside-avoid">
            <div class="max-w-md">
              @if (po.notes) {
                <span class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1 print:text-zinc-500">Notes</span>
                <p class="text-zinc-400 text-xs bg-zinc-950/30 border border-zinc-800/50 rounded-lg p-3 leading-relaxed whitespace-pre-wrap print:bg-zinc-50 print:border-zinc-300 print:text-black">{{ po.notes }}</p>
              }
            </div>

            <div class="w-64 space-y-2.5 text-sm print:text-black">
              <div class="flex justify-between text-zinc-400 print:text-zinc-700">
                <span>Total Items:</span>
                <span class="text-white print:text-black">{{ totalQty(po) }}</span>
              </div>
              <div class="flex justify-between text-zinc-400 print:text-zinc-700">
                <span>Items Subtotal:</span>
                <span class="print:text-black">{{ itemsSubtotal(po) | number:'1.2-2' }} {{ po.currency }}</span>
              </div>
              <div class="flex justify-between text-zinc-400 print:text-zinc-700">
                <span>Shipping Cost:</span>
                <span class="print:text-black">{{ (po.shippingCost || 0) | number:'1.2-2' }} {{ po.currency }}</span>
              </div>
              <div class="flex justify-between border-t border-zinc-800 pt-3 text-base font-bold text-white print:border-zinc-300 print:text-black">
                <span>Total Value:</span>
                <span class="text-white print:text-black">{{ po.totalValue | number:'1.2-2' }} {{ po.currency }}</span>
              </div>
            </div>
          </div>

        </div>
      }

    </div>
  `,
})
export class PurchaseOrderDetailComponent implements OnInit {
  readonly store = inject(PurchaseOrdersStore);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.store.loadPurchaseOrder(+id);
    }
  }

  getPoContact(supplier: any): any {
    if (!supplier || !supplier.contacts || supplier.contacts.length === 0) return null;
    return supplier.contacts.find((c: any) => c.sendPo) || supplier.contacts[0];
  }

  totalQty(po: any): number {
    return po.lineItems?.reduce((acc: number, item: any) => acc + Number(item.quantity), 0) || 0;
  }

  itemsSubtotal(po: any): number {
    return po.lineItems?.reduce((acc: number, item: any) => acc + Number(item.lineTotal || 0), 0) || 0;
  }

  exportPdf(): void {
    window.print();
  }

  updateStatus(event: Event): void {
    const status = (event.target as HTMLSelectElement).value as POStatus;
    const po = this.store.selectedPurchaseOrder();
    if (po) {
      this.store.updatePurchaseOrder({ id: po.id, dto: { status } });
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
