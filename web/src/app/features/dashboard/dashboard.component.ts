import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SuppliersStore } from '../../store/suppliers.store';
import { ProductsStore } from '../../store/products.store';
import { PurchaseOrdersStore } from '../../store/purchase-orders.store';
import { SamplesStore } from '../../store/samples.store';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface TrackingTimeline {
  id: number;
  trackingNumber: string;
  referenceName: string;
  type: string;
  status: string;
  estimatedDelivery?: string;
  checkpoints: {
    timestamp: string;
    location: string;
    description: string;
    code: string;
  }[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="p-8">
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-white">Dashboard</h1>
        <p class="text-zinc-400 text-sm mt-1">Welcome to Kora World</p>
      </div>

      <!-- Stats Grid -->
      <div 
        class="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8"
        [class.lg:grid-cols-3]="authService.currentUser()?.role === 'supplier'"
        [class.lg:grid-cols-4]="authService.currentUser()?.role !== 'supplier'"
      >
        <!-- Suppliers -->
        @if (authService.currentUser()?.role !== 'supplier') {
          <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <p class="text-zinc-400 text-sm mb-1">Suppliers</p>
            <p class="text-3xl font-bold text-white">{{ suppliersStore.totalSuppliers() }}</p>
            <a routerLink="/suppliers" class="text-zinc-500 text-xs hover:text-zinc-300 mt-2 inline-block">View all →</a>
          </div>
        }

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

      <!-- DHL Timelines Section -->
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
        <h2 class="text-lg font-bold text-white mb-6 flex items-center space-x-2">
          <span>✈️</span>
          <span>Active DHL Shipments Timeline</span>
        </h2>

        @if (loadingTimelines()) {
          <div class="text-zinc-500 text-sm py-8 text-center font-mono">Quiring DHL live tracking data...</div>
        } @else if (timelines().length === 0) {
          <div class="text-center py-10 bg-zinc-950/20 border border-dashed border-zinc-800 rounded-lg">
            <p class="text-2xl mb-2">📦</p>
            <p class="text-zinc-500 text-sm">No active DHL shipments currently in transit.</p>
          </div>
        } @else {
          <div class="space-y-8">
            @for (t of timelines(); track t.trackingNumber) {
              <div class="bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-5 space-y-4">
                <!-- Timeline Header Info -->
                <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-zinc-800/60 pb-3">
                  <div>
                    <span class="px-2 py-0.5 bg-yellow-950/50 text-yellow-400 border border-yellow-800/30 rounded text-[10px] font-bold tracking-wider mr-2 uppercase">DHL Express</span>
                    
                    @if (t.type === 'Purchase Order') {
                      <a [routerLink]="['/purchase-orders', t.id]" class="text-white hover:text-yellow-400 font-semibold text-sm hover:underline transition-colors">
                        {{ t.referenceName }}
                      </a>
                    } @else {
                      <a [routerLink]="['/samples', t.id]" class="text-white hover:text-yellow-400 font-semibold text-sm hover:underline transition-colors">
                        {{ t.referenceName }}
                      </a>
                    }
                    
                    <span class="text-zinc-500 text-xs ml-2">({{ t.type }})</span>
                    <span class="ml-2 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider capitalize border"
                      [class.bg-emerald-950/50]="t.status === 'DELIVERED'"
                      [class.text-emerald-400]="t.status === 'DELIVERED'"
                      [class.border-emerald-900/30]="t.status === 'DELIVERED'"
                      [class.bg-blue-950/50]="t.status !== 'DELIVERED'"
                      [class.text-blue-400]="t.status !== 'DELIVERED'"
                      [class.border-blue-900/30]="t.status !== 'DELIVERED'"
                    >
                      Status: {{ t.status }}
                    </span>
                  </div>
                  <div class="text-xs sm:text-right">
                    <span class="text-zinc-500">Tracking:</span>
                    <span class="font-mono text-zinc-300 font-bold ml-1">{{ t.trackingNumber }}</span>
                  </div>
                </div>

                <!-- Horizontal Process Flow -->
                <div class="py-4">
                  <!-- Stepper line container -->
                  <div class="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
                    <!-- Connector line behind items -->
                    <div class="hidden md:block absolute top-4 left-6 right-6 h-0.5 bg-zinc-800 z-0"></div>

                    @for (step of getTimelineSteps(t); track step.code; let i = $index) {
                      <div class="flex items-start md:flex-col md:items-center text-left md:text-center relative z-10 gap-3 md:gap-0">
                        <!-- Step Bubble Icon -->
                        <div 
                          [class]="step.active ? 'bg-emerald-500 text-zinc-950 font-bold shadow-lg ring-4 ring-emerald-950/60' : 'bg-zinc-850 text-zinc-500 border border-zinc-700'" 
                          class="w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0 md:mb-3"
                        >
                          {{ step.icon }}
                        </div>
                        <!-- Step Description -->
                        <div class="min-w-0">
                          <p [class.text-white]="step.active" [class.text-zinc-500]="!step.active" class="font-semibold text-xs transition-colors">
                            {{ step.title }}
                          </p>
                          <p class="text-[10px] text-zinc-500 mt-1 max-w-[150px] mx-auto md:line-clamp-2" [title]="step.desc || ''">
                            {{ step.desc || 'Waiting...' }}
                          </p>
                          @if (step.timestamp) {
                            <p class="text-[9px] text-zinc-600 font-mono mt-0.5">{{ step.timestamp | date:'dd MMM, hh:mm a' }}</p>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </div>
            }
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
  readonly authService = inject(AuthService);
  private readonly api = inject(ApiService);

  timelines = signal<TrackingTimeline[]>([]);
  loadingTimelines = signal(false);

  ngOnInit(): void {
    this.suppliersStore.loadSuppliers();
    this.productsStore.loadProducts({});
    
    // Load samples and POs, then fetch live tracking details for DHL items
    this.samplesStore.loadSamples();
    this.purchaseOrdersStore.loadPurchaseOrders();

    // Trigger load of live tracking details
    this.loadDhlTrackingTimelines();
  }

  loadDhlTrackingTimelines(): void {
    this.loadingTimelines.set(true);
    setTimeout(() => {
      const items = this.getDhlActiveShipments();
      if (items.length === 0) {
        this.loadingTimelines.set(false);
        return;
      }

      const requests = items.map(item => 
        this.api.getDhlTracking(item.trackingNumber).pipe(
          catchError(() => of(null))
        )
      );

      forkJoin(requests).subscribe({
        next: (results) => {
          const validTimelines: TrackingTimeline[] = [];
          results.forEach((res, index) => {
            if (res) {
              if (res.status === 'DELIVERED') {
                // Find delivered checkpoint timestamp to check if it's within 24 hours
                const deliveredCp = res.checkpoints.find((c: any) => c.code === 'DELIVERED');
                const deliveryTime = deliveredCp ? new Date(deliveredCp.timestamp).getTime() : new Date(res.lastUpdate).getTime();
                const hoursSinceDelivery = (Date.now() - deliveryTime) / (1000 * 60 * 60);
                
                if (hoursSinceDelivery <= 24) {
                  validTimelines.push({
                    id: items[index].id,
                    trackingNumber: res.trackingNumber,
                    referenceName: items[index].name,
                    type: items[index].type,
                    status: res.status,
                    estimatedDelivery: res.estimatedDelivery,
                    checkpoints: res.checkpoints,
                  });
                }
              } else {
                validTimelines.push({
                  id: items[index].id,
                  trackingNumber: res.trackingNumber,
                  referenceName: items[index].name,
                  type: items[index].type,
                  status: res.status,
                  estimatedDelivery: res.estimatedDelivery,
                  checkpoints: res.checkpoints,
                });
              }
            }
          });
          this.timelines.set(validTimelines);
          this.loadingTimelines.set(false);
        },
        error: (err) => {
          this.loadingTimelines.set(false);
          console.error('Failed to load tracking timelines:', err);
        }
      });
    }, 800);
  }

  getDhlActiveShipments(): any[] {
    const orders = this.purchaseOrdersStore.purchaseOrders()
      .filter((o: any) => o.carrier?.toLowerCase() === 'dhl' && o.trackingNumber && o.trackingNumber.trim().length > 0)
      .map((o: any) => ({
        id: o.id,
        type: 'Purchase Order',
        name: o.poNumber,
        trackingNumber: o.trackingNumber,
      }));

    const samples = this.samplesStore.samples()
      .filter((p: any) => p.carrier?.toLowerCase() === 'dhl' && p.trackingNumber && p.trackingNumber.trim().length > 0)
      .map((p: any) => ({
        id: p.id,
        type: 'Sample',
        name: p.name,
        trackingNumber: p.trackingNumber,
      }));

    return [...orders, ...samples];
  }

  getTimelineSteps(t: TrackingTimeline): any[] {
    const findCp = (code: string) => t.checkpoints.find(c => c.code === code);
    
    const pickedUp = findCp('PICKED_UP');
    const inTransit = findCp('IN_TRANSIT');
    const outForDelivery = findCp('OUT_FOR_DELIVERY');
    const delivered = findCp('DELIVERED');

    const steps = [
      {
        code: 'PICKED_UP',
        title: 'Picked Up',
        icon: '📤',
        active: !!pickedUp,
        timestamp: pickedUp?.timestamp || '',
        desc: pickedUp?.description || 'Package picked up by DHL',
      },
      {
        code: 'IN_TRANSIT',
        title: 'In Transit',
        icon: '✈️',
        active: !!inTransit,
        timestamp: inTransit?.timestamp || '',
        desc: inTransit?.description || 'In transit to destination',
      },
      {
        code: 'OUT_FOR_DELIVERY',
        title: 'Out for Delivery',
        icon: '🚚',
        active: !!outForDelivery,
        timestamp: outForDelivery?.timestamp || '',
        desc: outForDelivery?.description || 'Out for final delivery',
      },
      {
        code: 'DELIVERED',
        title: 'Delivered',
        icon: '✅',
        active: !!delivered,
        timestamp: delivered?.timestamp || '',
        desc: delivered?.description || 'Delivered & signed',
      }
    ];

    return steps;
  }
}
