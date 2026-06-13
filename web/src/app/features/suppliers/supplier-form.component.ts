import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SuppliersStore } from '../../store/suppliers.store';
import { ApiService } from '../../core/services/api.service';
import { CreateSupplierDto } from '../../core/models/supplier.model';

@Component({
  selector: 'app-supplier-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="p-8 max-w-2xl">

      <!-- Header -->
      <div class="mb-8">
        <a routerLink="/suppliers" class="text-zinc-500 hover:text-zinc-300 text-sm mb-4 inline-block">← Back to Suppliers</a>
        <h1 class="text-2xl font-bold text-white">{{ isEdit() ? 'Edit Supplier' : 'New Supplier' }}</h1>
      </div>

      <!-- Error -->
      @if (store.error()) {
        <div class="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
          {{ store.error() }}
        </div>
      }

      <!-- Form -->
      <form (ngSubmit)="submit()" class="space-y-5">

        <div class="grid grid-cols-2 gap-5">
          <div class="col-span-2">
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Supplier Name *</label>
            <input
              [(ngModel)]="form.name" name="name" required
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              placeholder="e.g. Sport Master Pakistan"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Country</label>
            <input
              [(ngModel)]="form.country" name="country"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              placeholder="e.g. Pakistan"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Currency</label>
            <input
              [(ngModel)]="form.currency" name="currency"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              placeholder="e.g. PKR, EUR, USD"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Contact Name</label>
            <input
              [(ngModel)]="form.contactName" name="contactName"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              placeholder="Full name"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Contact Email</label>
            <input
              [(ngModel)]="form.contactEmail" name="contactEmail" type="email"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              placeholder="email@supplier.com"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Contact Phone</label>
            <input
              [(ngModel)]="form.contactPhone" name="contactPhone"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              placeholder="+92 ..."
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Lead Time (days)</label>
            <input
              [(ngModel)]="form.leadTimeDays" name="leadTimeDays" type="number" min="1"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              placeholder="e.g. 45"
            />
          </div>

          <div class="col-span-2">
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Payment Terms</label>
            <input
              [(ngModel)]="form.paymentTerms" name="paymentTerms"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              placeholder="e.g. 30% upfront, 70% on shipment"
            />
          </div>

          <div class="col-span-2">
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Notes</label>
            <textarea
              [(ngModel)]="form.notes" name="notes" rows="3"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 resize-none"
              placeholder="Any additional notes..."
            ></textarea>
          </div>
        </div>

        <div class="flex gap-3 pt-2">
          <button
            type="submit"
            [disabled]="store.loading()"
            class="px-6 py-2.5 bg-white text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50"
          >
            {{ store.loading() ? 'Saving...' : (isEdit() ? 'Update Supplier' : 'Create Supplier') }}
          </button>
          <a
            routerLink="/suppliers"
            class="px-6 py-2.5 bg-zinc-800 text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </a>
        </div>

      </form>
    </div>
  `,
})
export class SupplierFormComponent implements OnInit {
  readonly store = inject(SuppliersStore);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly isEdit = signal(false);
  private editId = signal<number | null>(null);

  form: CreateSupplierDto = {
    name: '',
    country: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    paymentTerms: '',
    leadTimeDays: undefined,
    currency: '',
    notes: '',
  };

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.editId.set(+id);
      this.api.getSupplier(+id).subscribe((supplier) => {
        this.form = {
          name: supplier.name,
          country: supplier.country,
          contactName: supplier.contactName,
          contactEmail: supplier.contactEmail,
          contactPhone: supplier.contactPhone,
          paymentTerms: supplier.paymentTerms,
          leadTimeDays: supplier.leadTimeDays,
          currency: supplier.currency,
          notes: supplier.notes,
        };
      });
    }
  }

  submit(): void {
    if (!this.form.name) return;

    // Strip empty strings so validation doesn't fail on optional fields
    const dto = Object.fromEntries(
      Object.entries(this.form).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
    ) as CreateSupplierDto;

    if (this.isEdit() && this.editId()) {
      this.store.updateSupplier({ id: this.editId()!, dto });
    } else {
      this.store.createSupplier(dto);
    }

    this.router.navigate(['/suppliers']);
  }
}
