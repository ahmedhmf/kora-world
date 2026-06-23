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
import { LucideAngularModule } from 'lucide-angular';

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
  imports: [CommonModule, RouterLink, FormsModule, LucideAngularModule],
  templateUrl: './dashboard.component.html',
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
        icon: 'upload',
        active: !!pickedUp,
        timestamp: pickedUp?.timestamp || '',
        desc: pickedUp?.description || 'Package picked up by DHL',
      },
      {
        code: 'IN_TRANSIT',
        title: 'In Transit',
        icon: 'plane',
        active: !!inTransit,
        timestamp: inTransit?.timestamp || '',
        desc: inTransit?.description || 'In transit to destination',
      },
      {
        code: 'OUT_FOR_DELIVERY',
        title: 'Out for Delivery',
        icon: 'truck',
        active: !!outForDelivery,
        timestamp: outForDelivery?.timestamp || '',
        desc: outForDelivery?.description || 'Out for final delivery',
      },
      {
        code: 'DELIVERED',
        title: 'Delivered',
        icon: 'check-circle',
        active: !!delivered,
        timestamp: delivered?.timestamp || '',
        desc: delivered?.description || 'Delivered & signed',
      }
    ];

    return steps;
  }
}
