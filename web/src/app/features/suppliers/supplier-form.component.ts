import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SuppliersStore } from '../../store/suppliers.store';
import { ApiService } from '../../core/services/api.service';
import { CreateSupplierDto } from '../../core/models/supplier.model';
import { COUNTRIES } from '../../core/constants/countries';

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
      <form #supplierForm="ngForm" (ngSubmit)="supplierForm.valid && submit()" class="space-y-5">

        <div class="grid grid-cols-2 gap-5">
          
          <!-- Name (Required) -->
          <div class="col-span-2">
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Supplier Name *</label>
            <input
              [(ngModel)]="form.name" name="name" required #nameInput="ngModel"
              class="w-full bg-zinc-900 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              [class.border-zinc-700]="!nameInput.invalid || (!nameInput.dirty && !nameInput.touched)"
              [class.border-red-500]="nameInput.invalid && (nameInput.dirty || nameInput.touched)"
              placeholder="e.g. Sport Master Pakistan"
            />
            @if (nameInput.invalid && (nameInput.dirty || nameInput.touched)) {
              <p class="text-red-500 text-xs mt-1.5">Supplier Name is required</p>
            }
          </div>

          <!-- Country (Required - Searchable Dropdown) -->
          <div class="relative" (keydown.escape)="showCountryDropdown = false">
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Country *</label>
            
            <button
              type="button"
              (click)="showCountryDropdown = !showCountryDropdown"
              class="w-full bg-zinc-900 border text-left rounded-lg px-4 py-2.5 text-sm focus:outline-none flex justify-between items-center transition-colors"
              [class.border-zinc-700]="!countryInput.invalid || (!countryInput.dirty && !countryInput.touched)"
              [class.border-red-500]="countryInput.invalid && (countryInput.dirty || countryInput.touched)"
              [class.text-white]="form.country"
              [class.text-zinc-500]="!form.country"
            >
              <span>{{ form.country || 'Select a country' }}</span>
              <span class="text-zinc-500 text-xs">▼</span>
            </button>

            <!-- Hidden validation input -->
            <input
              type="hidden"
              [(ngModel)]="form.country"
              name="country"
              #countryInput="ngModel"
              required
            />

            <!-- Click outside backdrop -->
            @if (showCountryDropdown) {
              <div class="fixed inset-0 z-40" (click)="showCountryDropdown = false"></div>
            }

            <!-- Dropdown content -->
            @if (showCountryDropdown) {
              <div class="absolute left-0 right-0 mt-1.5 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col max-h-60">
                <div class="p-2 border-b border-zinc-800 flex items-center bg-zinc-900">
                  <span class="text-zinc-500 px-1 text-xs">🔍</span>
                  <input
                    type="text"
                    [(ngModel)]="countrySearchQuery"
                    name="countrySearch"
                    placeholder="Search country..."
                    class="w-full bg-transparent border-0 text-white text-sm focus:outline-none placeholder-zinc-500 p-1"
                    (click)="$event.stopPropagation()"
                    autofocus
                  />
                </div>
                <div class="overflow-y-auto flex-1 max-h-48 py-1">
                  @for (country of filteredCountries; track country) {
                    <button
                      type="button"
                      (click)="selectCountry(country)"
                      class="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                      {{ country }}
                    </button>
                  } @empty {
                    <div class="px-4 py-3 text-sm text-zinc-500">No countries found</div>
                  }
                </div>
              </div>
            }

            @if (countryInput.invalid && (countryInput.dirty || countryInput.touched)) {
              <p class="text-red-500 text-xs mt-1.5">Country is required</p>
            }
          </div>

          <!-- Currency (Required - Dropdown) -->
          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Currency *</label>
            <select
              [(ngModel)]="form.currency" name="currency" required #currencyInput="ngModel"
              class="w-full bg-zinc-900 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500"
              [class.border-zinc-700]="!currencyInput.invalid || (!currencyInput.dirty && !currencyInput.touched)"
              [class.border-red-500]="currencyInput.invalid && (currencyInput.dirty || currencyInput.touched)"
            >
              <option value="" disabled>Select currency</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="EGP">EGP</option>
            </select>
            @if (currencyInput.invalid && (currencyInput.dirty || currencyInput.touched)) {
              <p class="text-red-500 text-xs mt-1.5">Currency is required</p>
            }
          </div>

          <!-- Contact Name (Required) -->
          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Contact Name *</label>
            <input
              [(ngModel)]="form.contactName" name="contactName" required #contactNameInput="ngModel"
              class="w-full bg-zinc-900 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              [class.border-zinc-700]="!contactNameInput.invalid || (!contactNameInput.dirty && !contactNameInput.touched)"
              [class.border-red-500]="contactNameInput.invalid && (contactNameInput.dirty || contactNameInput.touched)"
              placeholder="Full name"
            />
            @if (contactNameInput.invalid && (contactNameInput.dirty || contactNameInput.touched)) {
              <p class="text-red-500 text-xs mt-1.5">Contact Name is required</p>
            }
          </div>

          <!-- Contact Email (Required + Email Validation) -->
          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Contact Email *</label>
            <input
              [(ngModel)]="form.contactEmail" name="contactEmail" type="email" required email #contactEmailInput="ngModel"
              class="w-full bg-zinc-900 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              [class.border-zinc-700]="!contactEmailInput.invalid || (!contactEmailInput.dirty && !contactEmailInput.touched)"
              [class.border-red-500]="contactEmailInput.invalid && (contactEmailInput.dirty || contactEmailInput.touched)"
              placeholder="email@supplier.com"
            />
            @if (contactEmailInput.invalid && (contactEmailInput.dirty || contactEmailInput.touched)) {
              <p class="text-red-500 text-xs mt-1.5">
                @if (contactEmailInput.errors?.['required']) {
                  Contact Email is required
                } @else {
                  Must be a valid email address
                }
              </p>
            }
          </div>

          <!-- Contact Phone (Required) -->
          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Contact Phone *</label>
            <input
              [(ngModel)]="form.contactPhone" name="contactPhone" required #contactPhoneInput="ngModel"
              class="w-full bg-zinc-900 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              [class.border-zinc-700]="!contactPhoneInput.invalid || (!contactPhoneInput.dirty && !contactPhoneInput.touched)"
              [class.border-red-500]="contactPhoneInput.invalid && (contactPhoneInput.dirty || contactPhoneInput.touched)"
              placeholder="+92 ..."
            />
            @if (contactPhoneInput.invalid && (contactPhoneInput.dirty || contactPhoneInput.touched)) {
              <p class="text-red-500 text-xs mt-1.5">Contact Phone is required</p>
            }
          </div>

          <!-- Lead Time (Optional) -->
          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Lead Time (days)</label>
            <input
              [(ngModel)]="form.leadTimeDays" name="leadTimeDays" type="number" min="1"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              placeholder="e.g. 45"
            />
          </div>

          <!-- Shipping Rate per kg (Optional) -->
          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Shipping Rate per kg</label>
            <input
              [(ngModel)]="form.shippingRatePerKg" name="shippingRatePerKg" type="number" min="0" step="0.01"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              placeholder="e.g. 2.50"
            />
          </div>

          <!-- Payment Terms (Optional) -->
          <div class="col-span-2">
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Payment Terms</label>
            <input
              [(ngModel)]="form.paymentTerms" name="paymentTerms"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              placeholder="e.g. 30% upfront, 70% on shipment"
            />
          </div>

          <!-- Notes (Optional) -->
          <div class="col-span-2">
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Notes</label>
            <textarea
              [(ngModel)]="form.notes" name="notes" rows="3"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 resize-none"
              placeholder="Any additional notes..."
            ></textarea>
          </div>
        </div>

        <!-- Submit & Cancel Buttons -->
        <div class="flex gap-3 pt-2">
          <button
            type="submit"
            [disabled]="store.loading() || supplierForm.invalid"
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

  showCountryDropdown = false;
  countrySearchQuery = '';

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
    shippingRatePerKg: undefined,
  };

  get filteredCountries(): string[] {
    const query = this.countrySearchQuery.toLowerCase().trim();
    if (!query) return COUNTRIES;
    return COUNTRIES.filter((c) => c.toLowerCase().includes(query));
  }

  selectCountry(country: string): void {
    this.form.country = country;
    this.showCountryDropdown = false;
    this.countrySearchQuery = '';
  }

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
          shippingRatePerKg: supplier.shippingRatePerKg,
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
