import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SuppliersStore } from '../../store/suppliers.store';
import { DialogService } from '../../core/services/dialog.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-suppliers-list',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './suppliers-list.component.html',
})
export class SuppliersListComponent implements OnInit {
  readonly store = inject(SuppliersStore);
  private readonly dialogService = inject(DialogService);

  ngOnInit(): void {
    this.store.loadSuppliers();
  }

  async delete(id: number): Promise<void> {
    const ok = await this.dialogService.confirm('Delete Supplier', 'Are you sure you want to delete this supplier?');
    if (ok) {
      this.store.deleteSupplier(id);
    }
  }

  getPrimaryContact(supplier: any): string {
    if (!supplier.contacts || supplier.contacts.length === 0) return '—';
    const contact = supplier.contacts.find((c: any) => c.sendInfo) || 
                    supplier.contacts.find((c: any) => c.sendPo) || 
                    supplier.contacts[0];
    return contact ? `${contact.name} (${contact.email})` : '—';
  }
}
