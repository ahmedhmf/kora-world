import { ChangeDetectorRef, Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ContactsStore } from '../../store/contacts.store';
import { SuppliersStore } from '../../store/suppliers.store';
import { AccountsStore } from '../../store/accounts.store';
import { ApiService } from '../../core/services/api.service';
import { Contact, ContactPhone, ContactType, CreateContactDto } from '../../core/models/contact.model';
import { Supplier } from '../../core/models/supplier.model';
import { B2BAccount } from '../../core/models/account.model';

@Component({
  selector: 'app-contact-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './contact-form.component.html',
})
export class ContactFormComponent implements OnInit {
  readonly store = inject(ContactsStore);
  readonly suppliersStore = inject(SuppliersStore);
  readonly accountsStore = inject(AccountsStore);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly isEdit = signal(false);
  private editId = signal<number | null>(null);

  // Form State
  phones: ContactPhone[] = [];
  form: Partial<CreateContactDto> = {
    name: '',
    company: '',
    position: '',
    type: 'marketing',
    email: '',
    whatsapp: '',
    facebook: '',
    instagram: '',
    address: '',
  };

  // Search & Filter Dropdowns for Suppliers and Accounts
  supplierSearch = '';
  showSupplierDropdown = signal(false);
  selectedSupplier = signal<Supplier | null>(null);

  accountSearch = '';
  showAccountDropdown = signal(false);
  selectedAccount = signal<B2BAccount | null>(null);

  filteredSuppliers = computed(() => {
    const q = this.supplierSearch.toLowerCase().trim();
    if (!q) return this.suppliersStore.suppliers().slice(0, 8);
    return this.suppliersStore.suppliers().filter(
      (s) => s.name.toLowerCase().includes(q)
    ).slice(0, 8);
  });

  filteredAccounts = computed(() => {
    const q = this.accountSearch.toLowerCase().trim();
    if (!q) return this.accountsStore.accounts().slice(0, 8);
    return this.accountsStore.accounts().filter(
      (a) => a.companyName.toLowerCase().includes(q) || a.primaryContactEmail.toLowerCase().includes(q)
    ).slice(0, 8);
  });

  ngOnInit(): void {
    // Load lists for linking dropdowns
    this.suppliersStore.loadSuppliers();
    this.accountsStore.loadAccounts();

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.isEdit.set(true);
        this.editId.set(+id);
        this.api.getContact(+id).subscribe({
          next: (contact) => {
            this.form = {
              name: contact.name,
              company: contact.company || '',
              position: contact.position || '',
              type: contact.type,
              email: contact.email || '',
              whatsapp: contact.whatsapp || '',
              facebook: contact.facebook || '',
              instagram: contact.instagram || '',
              address: contact.address || '',
            };
            this.phones = contact.phones ? JSON.parse(JSON.stringify(contact.phones)) : [];
            
            if (contact.type === 'supplier' && contact.supplier) {
              this.selectedSupplier.set(contact.supplier as Supplier);
            }
            if (contact.type === 'account' && contact.account) {
              this.selectedAccount.set(contact.account as B2BAccount);
            }
            
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('ContactForm: error fetching contact:', err);
          }
        });
      } else {
        this.isEdit.set(false);
        this.editId.set(null);
        this.form = {
          name: '',
          company: '',
          position: '',
          type: 'marketing',
          email: '',
          whatsapp: '',
          facebook: '',
          instagram: '',
          address: '',
        };
        this.phones = [{ number: '', label: 'Mobile' }];
        this.cdr.detectChanges();
      }
    });
  }

  // ── Types ──────────────────────────────────────
  onTypeChange(): void {
    if (this.form.type !== 'supplier') {
      this.clearSupplier();
    }
    if (this.form.type !== 'account') {
      this.clearAccount();
    }
  }

  // ── Supplier dropdown ───────────────────────────
  onSupplierSearch(q: string): void {
    this.showSupplierDropdown.set(q.length > 0);
  }

  selectSupplier(sup: Supplier): void {
    this.selectedSupplier.set(sup);
    this.showSupplierDropdown.set(false);
    this.supplierSearch = '';
  }

  clearSupplier(): void {
    this.selectedSupplier.set(null);
    this.supplierSearch = '';
  }

  // ── Account dropdown ────────────────────────────
  onAccountSearch(q: string): void {
    this.showAccountDropdown.set(q.length > 0);
  }

  selectAccount(acct: B2BAccount): void {
    this.selectedAccount.set(acct);
    this.showAccountDropdown.set(false);
    this.accountSearch = '';
  }

  clearAccount(): void {
    this.selectedAccount.set(null);
    this.accountSearch = '';
  }

  // ── Phone methods ───────────────────────────────
  addPhone(): void {
    this.phones.push({ number: '', label: 'Mobile' });
  }

  removePhone(index: number): void {
    this.phones.splice(index, 1);
  }

  // ── Submit ──────────────────────────────────────
  submit(): void {
    if (!this.form.name) return;

    const dto: CreateContactDto = {
      name: this.form.name,
      company: this.form.company || undefined,
      position: this.form.position || undefined,
      type: this.form.type as ContactType,
      email: this.form.email || undefined,
      whatsapp: this.form.whatsapp || undefined,
      facebook: this.form.facebook || undefined,
      instagram: this.form.instagram || undefined,
      address: this.form.address || undefined,
      phones: this.phones.filter((p) => p.number.trim().length > 0),
      supplierId: this.form.type === 'supplier' && this.selectedSupplier() ? this.selectedSupplier()!.id : undefined,
      accountId: this.form.type === 'account' && this.selectedAccount() ? this.selectedAccount()!.id : undefined,
    };

    const navigateBack = () => this.router.navigate(['/contacts']);

    if (this.isEdit() && this.editId()) {
      this.store.updateContact({ id: this.editId()!, dto, callback: navigateBack });
    } else {
      this.store.createContact({ dto, callback: navigateBack });
    }
  }
}
