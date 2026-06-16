import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AccountsStore } from '../../store/accounts.store';
import { ApiService } from '../../core/services/api.service';
import { CreateAccountDto, AccountStatus, CustomerType } from '../../core/models/account.model';
import { DialogService } from '../../core/services/dialog.service';

@Component({
  selector: 'app-account-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="p-8 max-w-5xl mx-auto">

      <!-- Header -->
      <div class="mb-8">
        <a routerLink="/accounts" class="text-zinc-500 hover:text-zinc-300 text-sm mb-4 inline-block transition-colors">
          ← Back to Accounts
        </a>
        <h1 class="text-2xl font-bold text-white">
          {{ isEdit() ? 'Edit B2B Account' : 'New B2B Account' }}
        </h1>
        <p class="text-zinc-400 text-sm mt-1">
          {{ isEdit() ? 'Update the account information below.' : 'Fill in the details to create a new B2B customer account.' }}
        </p>
      </div>

      <!-- Error Banner -->
      @if (store.error()) {
        <div class="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
          {{ store.error() }}
        </div>
      }

      <form #accountForm="ngForm" (ngSubmit)="accountForm.valid && submit()" class="space-y-6">

        <!-- ── SECTION 1: Company Info ───────────────────────── -->
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
          <h2 class="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-5 flex items-center gap-2">
            <svg class="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Company Information
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">

            <!-- Company Name (Required) -->
            <div class="md:col-span-2">
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Company Name *</label>
              <input
                [(ngModel)]="form.companyName" name="companyName" required #companyNameInput="ngModel"
                class="w-full bg-zinc-950 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none placeholder-zinc-600 transition-colors"
                [class.border-zinc-700]="!companyNameInput.invalid || (!companyNameInput.dirty && !companyNameInput.touched)"
                [class.border-red-500]="companyNameInput.invalid && (companyNameInput.dirty || companyNameInput.touched)"
                [class.focus:border-zinc-500]="true"
                placeholder="e.g. SportZone International"
              />
              @if (companyNameInput.invalid && (companyNameInput.dirty || companyNameInput.touched)) {
                <p class="text-red-500 text-xs mt-1.5">Company name is required</p>
              }
            </div>

            <!-- Customer Type (Required) -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Customer Type *</label>
              <select
                [(ngModel)]="form.customerType" name="customerType" required #customerTypeInput="ngModel"
                class="w-full bg-zinc-950 border rounded-lg px-4 py-2.5 text-sm focus:outline-none transition-colors appearance-none"
                [class.border-zinc-700]="!customerTypeInput.invalid || (!customerTypeInput.dirty && !customerTypeInput.touched)"
                [class.border-red-500]="customerTypeInput.invalid && (customerTypeInput.dirty || customerTypeInput.touched)"
                [class.text-white]="form.customerType"
                [class.text-zinc-500]="!form.customerType"
              >
                <option value="" disabled>Select type...</option>
                @for (type of customerTypes; track type) {
                  <option [value]="type" class="bg-zinc-900 text-white">{{ type }}</option>
                }
              </select>
              @if (customerTypeInput.invalid && (customerTypeInput.dirty || customerTypeInput.touched)) {
                <p class="text-red-500 text-xs mt-1.5">Customer type is required</p>
              }
            </div>

            <!-- Status -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Account Status</label>
              <select
                [(ngModel)]="form.status" name="status"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 transition-colors appearance-none"
              >
                <option value="under_discussion" class="bg-zinc-900">Under Discussion</option>
                <option value="active" class="bg-zinc-900">Active</option>
                <option value="suspended" class="bg-zinc-900">Suspended</option>
                <option value="inactive" class="bg-zinc-900">Inactive</option>
              </select>
            </div>

            <!-- Website -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Website</label>
              <input
                [(ngModel)]="form.website" name="website"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 transition-colors"
                placeholder="https://example.com"
              />
            </div>

            <!-- VAT Number -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">VAT / Tax Number</label>
              <input
                [(ngModel)]="form.vatNumber" name="vatNumber"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 transition-colors"
                placeholder="e.g. DE123456789"
              />
            </div>

          </div>
        </div>

        <!-- ── SECTION 2: Primary Contact ────────────────────── -->
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
          <h2 class="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-5 flex items-center gap-2">
            <svg class="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Primary Contact
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-5">

            <!-- Contact Name (Required) -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Full Name *</label>
              <input
                [(ngModel)]="form.primaryContactName" name="primaryContactName" required #contactNameInput="ngModel"
                class="w-full bg-zinc-950 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none placeholder-zinc-600 transition-colors"
                [class.border-zinc-700]="!contactNameInput.invalid || (!contactNameInput.dirty && !contactNameInput.touched)"
                [class.border-red-500]="contactNameInput.invalid && (contactNameInput.dirty || contactNameInput.touched)"
                placeholder="John Smith"
              />
              @if (contactNameInput.invalid && (contactNameInput.dirty || contactNameInput.touched)) {
                <p class="text-red-500 text-xs mt-1.5">Contact name is required</p>
              }
            </div>

            <!-- Contact Email (Required) -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Email *</label>
              <input
                [(ngModel)]="form.primaryContactEmail" name="primaryContactEmail" required email #contactEmailInput="ngModel"
                class="w-full bg-zinc-950 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none placeholder-zinc-600 transition-colors"
                [class.border-zinc-700]="!contactEmailInput.invalid || (!contactEmailInput.dirty && !contactEmailInput.touched)"
                [class.border-red-500]="contactEmailInput.invalid && (contactEmailInput.dirty || contactEmailInput.touched)"
                placeholder="john@company.com"
              />
              @if (contactEmailInput.invalid && (contactEmailInput.dirty || contactEmailInput.touched)) {
                <p class="text-red-500 text-xs mt-1.5">Valid email is required</p>
              }
            </div>

            <!-- Contact Phone -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Phone</label>
              <input
                [(ngModel)]="form.primaryContactPhone" name="primaryContactPhone"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 transition-colors"
                placeholder="+1 555 000 0000"
              />
            </div>

          </div>
        </div>

        <!-- ── SECTION 3: Billing & Shipping Address ─────────── -->
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
          <h2 class="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-5 flex items-center gap-2">
            <svg class="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Addresses
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">

            <!-- Billing Address -->
            <div class="space-y-3">
              <h3 class="text-xs font-semibold text-zinc-500 uppercase tracking-wide border-b border-zinc-800 pb-2">Billing Address</h3>
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Street</label>
                <input [(ngModel)]="form.billingStreet" name="billingStreet"
                  class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                  placeholder="123 Business Ave" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-zinc-400 mb-1">City</label>
                  <input [(ngModel)]="form.billingCity" name="billingCity"
                    class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                    placeholder="City" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-zinc-400 mb-1">ZIP / Postal</label>
                  <input [(ngModel)]="form.billingZip" name="billingZip"
                    class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                    placeholder="ZIP" />
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Country</label>
                <input [(ngModel)]="form.billingCountry" name="billingCountry"
                  class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                  placeholder="Country" />
              </div>
            </div>

            <!-- Shipping Address -->
            <div class="space-y-3">
              <div class="flex items-center justify-between border-b border-zinc-800 pb-2">
                <h3 class="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Shipping Address</h3>
                <button type="button" (click)="copyBillingToShipping()"
                  class="text-xs text-zinc-400 hover:text-white transition-colors font-medium">
                  Same as billing ↙
                </button>
              </div>
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Street</label>
                <input [(ngModel)]="form.shippingStreet" name="shippingStreet"
                  class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                  placeholder="123 Warehouse Rd" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-zinc-400 mb-1">City</label>
                  <input [(ngModel)]="form.shippingCity" name="shippingCity"
                    class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                    placeholder="City" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-zinc-400 mb-1">ZIP / Postal</label>
                  <input [(ngModel)]="form.shippingZip" name="shippingZip"
                    class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                    placeholder="ZIP" />
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Country</label>
                <input [(ngModel)]="form.shippingCountry" name="shippingCountry"
                  class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                  placeholder="Country" />
              </div>
            </div>

          </div>
        </div>

        <!-- ── SECTION 4: Financial Terms ────────────────────── -->
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
          <h2 class="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-5 flex items-center gap-2">
            <svg class="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Financial Terms
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-5">

            <!-- Default Currency -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Default Currency</label>
              <select
                [(ngModel)]="form.defaultCurrency" name="defaultCurrency"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 transition-colors appearance-none"
              >
                @for (curr of currencies; track curr.code) {
                  <option [value]="curr.code" class="bg-zinc-900">{{ curr.code }} – {{ curr.name }}</option>
                }
              </select>
            </div>

            <!-- Credit Limit -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Credit Limit</label>
              <input
                [(ngModel)]="form.creditLimit" name="creditLimit" type="number" min="0" step="100"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 transition-colors"
                placeholder="0"
              />
            </div>

            <!-- Payment Terms -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Payment Terms</label>
              <input
                [(ngModel)]="form.paymentTerms" name="paymentTerms"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 transition-colors"
                placeholder="e.g. Net 30, COD"
              />
            </div>

          </div>
        </div>

        <!-- ── SECTION 5: Remarks ─────────────────────────────── -->
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
          <h2 class="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-5 flex items-center gap-2">
            <svg class="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Remarks & Internal Notes
          </h2>
          <textarea
            [(ngModel)]="form.remarks" name="remarks" rows="4"
            class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 resize-none transition-colors"
            placeholder="Internal notes about this account (not visible to client)..."
          ></textarea>
        </div>

        <!-- ── Submit Bar ─────────────────────────────────────── -->
        <div class="flex items-center gap-3 pt-2 pb-8">
          <button
            type="submit"
            [disabled]="store.loading() || accountForm.invalid"
            class="px-6 py-2.5 bg-white text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ store.loading() ? 'Saving...' : (isEdit() ? 'Update Account' : 'Create Account') }}
          </button>
          <a
            routerLink="/accounts"
            class="px-6 py-2.5 bg-zinc-800 text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </a>
          @if (isEdit()) {
            <button
              type="button"
              (click)="confirmDelete()"
              class="ml-auto px-4 py-2.5 text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
            >
              Delete Account
            </button>
          }
        </div>

      </form>
    </div>
  `,
})
export class AccountFormComponent implements OnInit {
  readonly store = inject(AccountsStore);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogService = inject(DialogService);

  readonly isEdit = signal(false);
  private editId = signal<number | null>(null);

  readonly customerTypes: CustomerType[] = [
    'Retailer', 'Distributor', 'Sports Club', 'School / Academy', 'Corporate', 'Other'
  ];

  readonly currencies = [
    { code: 'USD', name: 'US Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'EGP', name: 'Egyptian Pound' },
    { code: 'AED', name: 'UAE Dirham' },
    { code: 'SAR', name: 'Saudi Riyal' },
    { code: 'MAD', name: 'Moroccan Dirham' },
    { code: 'DZD', name: 'Algerian Dinar' },
  ];

  form: Partial<CreateAccountDto> = {
    companyName: '',
    status: 'under_discussion',
    customerType: undefined,
    website: '',
    primaryContactName: '',
    primaryContactEmail: '',
    primaryContactPhone: '',
    billingStreet: '',
    billingCity: '',
    billingZip: '',
    billingCountry: '',
    shippingStreet: '',
    shippingCity: '',
    shippingZip: '',
    shippingCountry: '',
    defaultCurrency: 'USD',
    paymentTerms: '',
    creditLimit: 0,
    vatNumber: '',
    remarks: '',
  };

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.isEdit.set(true);
        this.editId.set(+id);
        this.api.getAccount(+id).subscribe({
          next: (account) => {
            this.form = {
              companyName: account.companyName,
              status: account.status,
              customerType: account.customerType,
              website: account.website || '',
              primaryContactName: account.primaryContactName,
              primaryContactEmail: account.primaryContactEmail,
              primaryContactPhone: account.primaryContactPhone || '',
              billingStreet: account.billingStreet || '',
              billingCity: account.billingCity || '',
              billingZip: account.billingZip || '',
              billingCountry: account.billingCountry || '',
              shippingStreet: account.shippingStreet || '',
              shippingCity: account.shippingCity || '',
              shippingZip: account.shippingZip || '',
              shippingCountry: account.shippingCountry || '',
              defaultCurrency: account.defaultCurrency || 'USD',
              paymentTerms: account.paymentTerms || '',
              creditLimit: account.creditLimit || 0,
              vatNumber: account.vatNumber || '',
              remarks: account.remarks || '',
            };
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('AccountForm: error fetching account:', err);
          }
        });
      } else {
        this.isEdit.set(false);
        this.editId.set(null);
        this.resetForm();
      }
    });
  }

  private resetForm(): void {
    this.form = {
      companyName: '',
      status: 'under_discussion',
      customerType: undefined,
      website: '',
      primaryContactName: '',
      primaryContactEmail: '',
      primaryContactPhone: '',
      billingStreet: '',
      billingCity: '',
      billingZip: '',
      billingCountry: '',
      shippingStreet: '',
      shippingCity: '',
      shippingZip: '',
      shippingCountry: '',
      defaultCurrency: 'USD',
      paymentTerms: '',
      creditLimit: 0,
      vatNumber: '',
      remarks: '',
    };
  }

  copyBillingToShipping(): void {
    this.form.shippingStreet = this.form.billingStreet;
    this.form.shippingCity = this.form.billingCity;
    this.form.shippingZip = this.form.billingZip;
    this.form.shippingCountry = this.form.billingCountry;
  }

  submit(): void {
    if (!this.form.companyName || !this.form.primaryContactName || !this.form.primaryContactEmail) return;

    const dto: CreateAccountDto = {
      companyName: this.form.companyName,
      status: this.form.status,
      customerType: this.form.customerType!,
      website: this.form.website || undefined,
      primaryContactName: this.form.primaryContactName,
      primaryContactEmail: this.form.primaryContactEmail,
      primaryContactPhone: this.form.primaryContactPhone || undefined,
      billingStreet: this.form.billingStreet || undefined,
      billingCity: this.form.billingCity || undefined,
      billingZip: this.form.billingZip || undefined,
      billingCountry: this.form.billingCountry || undefined,
      shippingStreet: this.form.shippingStreet || undefined,
      shippingCity: this.form.shippingCity || undefined,
      shippingZip: this.form.shippingZip || undefined,
      shippingCountry: this.form.shippingCountry || undefined,
      defaultCurrency: this.form.defaultCurrency || 'USD',
      paymentTerms: this.form.paymentTerms || undefined,
      creditLimit: this.form.creditLimit ? +this.form.creditLimit : 0,
      vatNumber: this.form.vatNumber || undefined,
      remarks: this.form.remarks || undefined,
    };

    if (this.isEdit() && this.editId()) {
      this.store.updateAccount({ id: this.editId()!, dto });
    } else {
      this.store.createAccount(dto);
    }

    this.router.navigate(['/accounts']);
  }

  async confirmDelete(): Promise<void> {
    const ok = await this.dialogService.confirm('Delete Account', 'Are you sure you want to delete this account? This action cannot be undone.');
    if (ok) {
      this.store.deleteAccount(this.editId()!);
      this.router.navigate(['/accounts']);
    }
  }
}
