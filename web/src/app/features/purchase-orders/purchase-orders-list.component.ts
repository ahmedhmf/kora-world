import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { PurchaseOrdersStore } from '../../store/purchase-orders.store';
import { DialogService } from '../../core/services/dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-purchase-orders-list',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, LucideAngularModule],
  templateUrl: './purchase-orders-list.component.html',
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
