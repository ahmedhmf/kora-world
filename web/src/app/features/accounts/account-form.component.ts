import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AccountsStore } from '../../store/accounts.store';
import { ApiService } from '../../core/services/api.service';
import { CreateAccountDto, AccountStatus, CustomerType } from '../../core/models/account.model';
import { DropdownOptionsService } from '../../core/services/dropdown-options.service';
import { DropdownOption } from '../../core/models/dropdown-option.model';
import { DialogService } from '../../core/services/dialog.service';

@Component({
  selector: 'app-account-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './account-form.component.html',
})
export class AccountFormComponent implements OnInit {
  readonly store = inject(AccountsStore);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogService = inject(DialogService);
  private readonly dropdownOptions = inject(DropdownOptionsService);
  readonly paymentModels = signal<DropdownOption[]>([]);

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
    paymentModel: undefined,
    consignmentPricingMethod: 'fixed',
    settlementDueDay: 5,
    upfrontPercent: 30,
    balanceDue: 'Before delivery',
    paymentTerms: '',
    creditLimit: 0,
    vatNumber: '',
    remarks: '',
  };

  ngOnInit(): void {
    this.dropdownOptions.getOptions('accountPaymentModel').subscribe({
      next: options => { this.paymentModels.set(options); this.cdr.detectChanges(); },
      error: err => console.error('Could not load account payment models', err),
    });
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
              paymentModel: account.paymentModel || undefined,
              consignmentPricingMethod: account.consignmentPricingMethod || 'fixed',
              consignmentSharePercent: account.consignmentSharePercent ?? undefined,
              settlementDueDay: account.settlementDueDay ?? 5,
              upfrontPercent: account.upfrontPercent ?? 30,
              balanceDue: account.balanceDue || 'Before delivery',
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
      consignmentPricingMethod: 'fixed',
      settlementDueDay: 5,
      upfrontPercent: 30,
      balanceDue: 'Before delivery',
      paymentTerms: '',
      creditLimit: 0,
      vatNumber: '',
      remarks: '',
    };
  }

  isConsignment(): boolean {
    return this.form.paymentModel === 'Consignment' || this.form.paymentModel === 'Consignment (Monthly Settlement)';
  }

  isHistoricalPaymentModel(): boolean {
    return !!this.form.paymentModel && !['Full Payment Upfront', 'Split Payment', 'Consignment'].includes(this.form.paymentModel) && !this.paymentModels().some(option => option.value === this.form.paymentModel);
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
      paymentModel: this.form.paymentModel || undefined,
      consignmentPricingMethod: this.isConsignment() ? this.form.consignmentPricingMethod || 'fixed' : undefined,
      consignmentSharePercent: this.isConsignment() && this.form.consignmentPricingMethod === 'percentage' ? Number(this.form.consignmentSharePercent) : undefined,
      settlementDueDay: this.isConsignment() ? Number(this.form.settlementDueDay) : undefined,
      upfrontPercent: this.form.paymentModel === 'Split Payment' ? Number(this.form.upfrontPercent) : undefined,
      balanceDue: this.form.paymentModel === 'Split Payment' ? this.form.balanceDue : undefined,
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
