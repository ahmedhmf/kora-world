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
  template: `
    <div class="p-8 max-w-2xl mx-auto">

      <!-- Header -->
      <div class="mb-8">
        <a routerLink="/contacts" class="text-zinc-500 hover:text-zinc-300 text-sm mb-4 inline-block transition-colors">← Back to Contacts</a>
        <h1 class="text-2xl font-bold text-white">{{ isEdit() ? 'Edit Contact' : 'New Contact' }}</h1>
        <p class="text-zinc-400 text-sm mt-1">Fill out the form below to manage contact information in the contact book.</p>
      </div>

      <!-- Error Message -->
      @if (store.error()) {
        <div class="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
          {{ store.error() }}
        </div>
      }

      <!-- Form -->
      <form #contactForm="ngForm" (ngSubmit)="contactForm.valid && submit()" class="space-y-6">
        
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 space-y-5">
          <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 font-mono">Basic Details</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <!-- Name (Required) -->
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Full Name *</label>
              <input
                [(ngModel)]="form.name" name="name" required #nameInput="ngModel"
                class="w-full bg-zinc-950 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 transition-colors"
                [class.border-zinc-700]="!nameInput.invalid || (!nameInput.dirty && !nameInput.touched)"
                [class.border-red-500]="nameInput.invalid && (nameInput.dirty || nameInput.touched)"
                placeholder="e.g. John Doe"
              />
              @if (nameInput.invalid && (nameInput.dirty || nameInput.touched)) {
                <p class="text-red-500 text-xs mt-1.5">Contact Name is required</p>
              }
            </div>

            <!-- Position/Role -->
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Position / Role</label>
              <input
                [(ngModel)]="form.position" name="position"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 transition-colors"
                placeholder="e.g. Accounts Manager"
              />
            </div>

            <!-- Type Selector (Required) -->
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Contact Type *</label>
              <select
                [(ngModel)]="form.type" name="type" required #typeInput="ngModel" (change)="onTypeChange()"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 appearance-none"
              >
                <option value="" disabled>Select Type</option>
                <option value="marketing">Marketing</option>
                <option value="legal">Legal</option>
                <option value="finance">Finance</option>
                <option value="supplier">Supplier</option>
                <option value="account">Account</option>
                <option value="driver">Driver</option>
                <option value="warehouse">Warehouse</option>
              </select>
              @if (typeInput.invalid && (typeInput.dirty || typeInput.touched)) {
                <p class="text-red-500 text-xs mt-1.5">Contact Type is required</p>
              }
            </div>

            <!-- Company Name (Hidden/Free-text if not Account or Supplier) -->
            @if (form.type !== 'supplier' && form.type !== 'account') {
              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-zinc-400 mb-1.5">Company</label>
                <input
                  [(ngModel)]="form.company" name="company"
                  class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 transition-colors"
                  placeholder="e.g. Acme Marketing Agency"
                />
              </div>
            }

            <!-- Supplier Picker -->
            @if (form.type === 'supplier') {
              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-zinc-400 mb-1.5">Linked Supplier *</label>
                <div class="relative">
                  <input
                    type="text"
                    [(ngModel)]="supplierSearch"
                    (ngModelChange)="onSupplierSearch($event)"
                    [placeholder]="selectedSupplier() ? selectedSupplier()!.name : 'Search supplier...'"
                    name="supplierSearch"
                    class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-500"
                    autocomplete="off"
                  />
                  @if (showSupplierDropdown() && filteredSuppliers().length > 0) {
                    <div class="absolute left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 max-h-56 overflow-y-auto">
                      @for (sup of filteredSuppliers(); track sup.id) {
                        <button type="button" (click)="selectSupplier(sup)"
                          class="w-full text-left px-4 py-2.5 hover:bg-zinc-800 transition-colors">
                          <div class="text-white text-sm font-medium">{{ sup.name }}</div>
                          <div class="text-zinc-500 text-xs">{{ sup.country }} · {{ sup.currency }}</div>
                        </button>
                      }
                    </div>
                  }
                </div>
                @if (selectedSupplier()) {
                  <div class="mt-2 flex items-center gap-2 bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2">
                    <span class="text-xs text-white font-semibold">Selected Supplier:</span>
                    <span class="text-blue-400 text-xs font-semibold">{{ selectedSupplier()!.name }}</span>
                    <button type="button" (click)="clearSupplier()" class="ml-auto text-zinc-500 hover:text-zinc-300 transition-colors text-xs">✕</button>
                  </div>
                }
              </div>
            }

            <!-- Account Picker -->
            @if (form.type === 'account') {
              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-zinc-400 mb-1.5">Linked Account *</label>
                <div class="relative">
                  <input
                    type="text"
                    [(ngModel)]="accountSearch"
                    (ngModelChange)="onAccountSearch($event)"
                    [placeholder]="selectedAccount() ? selectedAccount()!.companyName : 'Search B2B account...'"
                    name="accountSearch"
                    class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-500"
                    autocomplete="off"
                  />
                  @if (showAccountDropdown() && filteredAccounts().length > 0) {
                    <div class="absolute left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 max-h-56 overflow-y-auto">
                      @for (acct of filteredAccounts(); track acct.id) {
                        <button type="button" (click)="selectAccount(acct)"
                          class="w-full text-left px-4 py-2.5 hover:bg-zinc-800 transition-colors">
                          <div class="text-white text-sm font-medium">{{ acct.companyName }}</div>
                          <div class="text-zinc-500 text-xs">{{ acct.customerType }}</div>
                        </button>
                      }
                    </div>
                  }
                </div>
                @if (selectedAccount()) {
                  <div class="mt-2 flex items-center gap-2 bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2">
                    <span class="text-xs text-white font-semibold">Selected Account:</span>
                    <span class="text-amber-400 text-xs font-semibold">{{ selectedAccount()!.companyName }}</span>
                    <button type="button" (click)="clearAccount()" class="ml-auto text-zinc-500 hover:text-zinc-300 transition-colors text-xs">✕</button>
                  </div>
                }
              </div>
            }

          </div>
        </div>

        <!-- ── SECTION 2: Contact Methods ─────────────────────── -->
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 space-y-5">
          <div class="flex justify-between items-center mb-2">
            <div>
              <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-mono">Contact Details</h2>
              <p class="text-zinc-500 text-xs mt-0.5 font-normal">Add phone numbers and general communication methods.</p>
            </div>
            <button
              type="button"
              (click)="addPhone()"
              class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-md transition-colors"
            >
              + Add Phone
            </button>
          </div>

          <!-- Multiple Phone Numbers Builder -->
          <div class="space-y-3">
            @for (phone of phones; track $index; let i = $index) {
              <div class="flex gap-3 items-center">
                <input
                  type="text"
                  [(ngModel)]="phone.number"
                  [name]="'phoneNumber_' + i"
                  required
                  placeholder="Phone number"
                  class="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-zinc-500 font-mono"
                />
                <select
                  [(ngModel)]="phone.label"
                  [name]="'phoneLabel_' + i"
                  required
                  class="w-32 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-zinc-500"
                >
                  <option value="Mobile">Mobile</option>
                  <option value="Work">Work</option>
                  <option value="Home">Home</option>
                  <option value="Fax">Fax</option>
                  <option value="Other">Other</option>
                </select>
                <button
                  type="button"
                  (click)="removePhone(i)"
                  class="text-red-500 hover:text-red-400 font-bold px-2 text-sm"
                >
                  ✕
                </button>
              </div>
            } @empty {
              <div class="border border-dashed border-zinc-800/80 rounded-lg p-4 text-center">
                <p class="text-zinc-500 text-xs italic">No phone numbers added yet.</p>
              </div>
            }
          </div>

          <!-- Other Contact Info -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3">
            <!-- Email -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Email Address</label>
              <input
                [(ngModel)]="form.email" name="email" type="email" #emailInput="ngModel"
                class="w-full bg-zinc-950 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 transition-colors"
                [class.border-zinc-700]="!emailInput.invalid"
                [class.border-red-500]="emailInput.invalid"
                placeholder="email@company.com"
              />
            </div>

            <!-- WhatsApp Number -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">WhatsApp Number</label>
              <input
                [(ngModel)]="form.whatsapp" name="whatsapp"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 transition-colors font-mono"
                placeholder="e.g. +1234567890"
              />
            </div>

            <!-- Facebook -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Facebook Profile / Link</label>
              <input
                [(ngModel)]="form.facebook" name="facebook"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 transition-colors"
                placeholder="e.g. facebook.com/profile"
              />
            </div>

            <!-- Instagram -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Instagram @Username / Link</label>
              <input
                [(ngModel)]="form.instagram" name="instagram"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 transition-colors"
                placeholder="e.g. instagram_user"
              />
            </div>

            <!-- Address -->
            <div class="md:col-span-2">
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Physical Address</label>
              <textarea
                [(ngModel)]="form.address" name="address" rows="3"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 resize-none"
                placeholder="Street address, City, Country, ZIP..."
              ></textarea>
            </div>

          </div>
        </div>

        <!-- Submit & Cancel -->
        <div class="flex gap-3 pt-2 pb-8">
          <button
            type="submit"
            [disabled]="store.loading() || contactForm.invalid || (form.type === 'supplier' && !selectedSupplier()) || (form.type === 'account' && !selectedAccount())"
            class="px-6 py-2.5 bg-white text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ store.loading() ? 'Saving...' : (isEdit() ? 'Update Contact' : 'Create Contact') }}
          </button>
          <a
            routerLink="/contacts"
            class="px-6 py-2.5 bg-zinc-800 text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </a>
        </div>

      </form>
    </div>
  `,
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
