import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { PurchaseOrdersStore } from '../../store/purchase-orders.store';
import { POStatus } from '../../core/models/purchase-order.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-purchase-order-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe],
  templateUrl: './purchase-order-detail.component.html',
})
export class PurchaseOrderDetailComponent implements OnInit {
  readonly store = inject(PurchaseOrdersStore);
  readonly authService = inject(AuthService);
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
