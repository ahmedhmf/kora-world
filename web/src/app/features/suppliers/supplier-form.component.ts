import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SuppliersStore } from '../../store/suppliers.store';
import { ApiService } from '../../core/services/api.service';
import { CreateSupplierDto, SupplierContact } from '../../core/models/supplier.model';
import { COUNTRIES } from '../../core/constants/countries';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-supplier-form',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './supplier-form.component.html',
})
export class SupplierFormComponent implements OnInit {
  readonly store = inject(SuppliersStore);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly isEdit = signal(false);
  private editId = signal<number | null>(null);

  showCountryDropdown = false;
  countrySearchQuery = '';

  contacts: SupplierContact[] = [];

  form: Partial<CreateSupplierDto> = {
    name: '',
    country: '',
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

  addContact(): void {
    this.contacts.push({
      name: '',
      email: '',
      phone: '',
      role: '',
      sendInfo: false,
      sendPo: false,
    });
  }

  removeContact(index: number): void {
    this.contacts.splice(index, 1);
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.isEdit.set(true);
        this.editId.set(+id);
        this.api.getSupplier(+id).subscribe({
          next: (supplier) => {
            this.form = {
              name: supplier.name,
              country: supplier.country,
              paymentTerms: supplier.paymentTerms,
              leadTimeDays: supplier.leadTimeDays,
              currency: supplier.currency,
              notes: supplier.notes,
              shippingRatePerKg: supplier.shippingRatePerKg,
            };
            this.contacts = supplier.contacts ? JSON.parse(JSON.stringify(supplier.contacts)) : [];
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('SupplierForm: error fetching supplier:', err);
          }
        });
      } else {
        this.isEdit.set(false);
        this.editId.set(null);
        this.form = {
          name: '',
          country: '',
          paymentTerms: '',
          leadTimeDays: undefined,
          currency: '',
          notes: '',
          shippingRatePerKg: undefined,
        };
        // Default with 1 contact
        this.contacts = [{
          name: '',
          email: '',
          phone: '',
          role: 'Sales',
          sendInfo: true,
          sendPo: true,
        }];
        this.cdr.detectChanges();
      }
    });
  }

  submit(): void {
    if (!this.form.name || this.contacts.length === 0) return;

    // Filter empty strings and format payload
    const dto: CreateSupplierDto = {
      name: this.form.name,
      country: this.form.country || '',
      currency: this.form.currency || '',
      paymentTerms: this.form.paymentTerms || undefined,
      leadTimeDays: this.form.leadTimeDays ? +this.form.leadTimeDays : undefined,
      notes: this.form.notes || undefined,
      shippingRatePerKg: this.form.shippingRatePerKg ? +this.form.shippingRatePerKg : undefined,
      contacts: this.contacts.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone || '',
        role: c.role || '',
        sendInfo: !!c.sendInfo,
        sendPo: !!c.sendPo,
      })),
    };

    if (this.isEdit() && this.editId()) {
      this.store.updateSupplier({ id: this.editId()!, dto });
    } else {
      this.store.createSupplier(dto);
    }

    this.router.navigate(['/suppliers']);
  }
}
