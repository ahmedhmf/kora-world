import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UsersStore } from '../../store/users.store';
import { SuppliersStore } from '../../store/suppliers.store';
import { ApiService } from '../../core/services/api.service';
import { CreateUserDto } from '../../core/models/user.model';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="p-8 max-w-2xl">

      <!-- Header -->
      <div class="mb-8">
        <a routerLink="/users" class="text-zinc-500 hover:text-zinc-300 text-sm mb-4 inline-block">← Back to Employees</a>
        <h1 class="text-2xl font-bold text-white">{{ isEdit() ? 'Edit Employee Account' : 'New Employee Account' }}</h1>
      </div>

      <!-- Error -->
      @if (store.error()) {
        <div class="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
          {{ store.error() }}
        </div>
      }

      <!-- Form -->
      <form #userForm="ngForm" (ngSubmit)="userForm.valid && submit()" class="space-y-5">
        <div class="grid grid-cols-2 gap-5">

          <!-- Name (Required) -->
          <div class="col-span-2">
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Full Name *</label>
            <input
              [(ngModel)]="form.name" name="name" required #nameInput="ngModel"
              class="w-full bg-zinc-900 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              [class.border-zinc-700]="!nameInput.invalid || (!nameInput.dirty && !nameInput.touched)"
              [class.border-red-500]="nameInput.invalid && (nameInput.dirty || nameInput.touched)"
              placeholder="e.g. John Doe"
            />
            @if (nameInput.invalid && (nameInput.dirty || nameInput.touched)) {
              <p class="text-red-500 text-xs mt-1.5">Full Name is required</p>
            }
          </div>

          <!-- Email (Required + Valid Format) -->
          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Email Address *</label>
            <input
              [(ngModel)]="form.email" name="email" type="email" required email #emailInput="ngModel"
              class="w-full bg-zinc-900 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              [class.border-zinc-700]="!emailInput.invalid || (!emailInput.dirty && !emailInput.touched)"
              [class.border-red-500]="emailInput.invalid && (emailInput.dirty || emailInput.touched)"
              placeholder="email@kora.com"
            />
            @if (emailInput.invalid && (emailInput.dirty || emailInput.touched)) {
              <p class="text-red-500 text-xs mt-1.5">
                @if (emailInput.errors?.['required']) { Email is required }
                @else { Must be a valid email address }
              </p>
            }
          </div>

          <!-- Role (Required) -->
          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">System Role *</label>
            <select
              [(ngModel)]="form.role" name="role" required #roleInput="ngModel"
              class="w-full bg-zinc-900 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500"
              [class.border-zinc-700]="!roleInput.invalid || (!roleInput.dirty && !roleInput.touched)"
              [class.border-red-500]="roleInput.invalid && (roleInput.dirty || roleInput.touched)"
            >
              <option value="" disabled>Select a role</option>
              <option value="admin">Admin (Full Access)</option>
              <option value="employee">Employee (Standard Access)</option>
              <option value="supplier">Supplier (View Only)</option>
            </select>
            @if (roleInput.invalid && (roleInput.dirty || roleInput.touched)) {
              <p class="text-red-500 text-xs mt-1.5">Role is required</p>
            }
          </div>

          <!-- Supplier Select (conditional on Role == supplier) -->
          @if (form.role === 'supplier') {
            <div class="col-span-2">
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Attach to Supplier *</label>
              <select
                [(ngModel)]="form.supplierId" name="supplierId" required #supplierInput="ngModel"
                class="w-full bg-zinc-900 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500"
                [class.border-zinc-700]="!supplierInput.invalid || (!supplierInput.dirty && !supplierInput.touched)"
                [class.border-red-500]="supplierInput.invalid && (supplierInput.dirty || supplierInput.touched)"
              >
                <option value="" disabled>Select a supplier</option>
                @for (supplier of suppliersStore.suppliers(); track supplier.id) {
                  <option [value]="supplier.id">{{ supplier.name }}</option>
                }
              </select>
              @if (supplierInput.invalid && (supplierInput.dirty || supplierInput.touched)) {
                <p class="text-red-500 text-xs mt-1.5">Supplier attachment is required for supplier accounts</p>
              }
            </div>
          }

          <!-- Password -->
          <div class="col-span-2">
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">
              {{ isEdit() ? 'Change Password (Leave blank to keep current)' : 'Password *' }}
            </label>
            <input
              [(ngModel)]="form.password" name="password" [required]="!isEdit()" #passwordInput="ngModel"
              type="password"
              class="w-full bg-zinc-900 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              [class.border-zinc-700]="!passwordInput.invalid || (!passwordInput.dirty && !passwordInput.touched)"
              [class.border-red-500]="passwordInput.invalid && (passwordInput.dirty || passwordInput.touched)"
              placeholder="••••••••"
            />
            @if (passwordInput.invalid && (passwordInput.dirty || passwordInput.touched)) {
              <p class="text-red-500 text-xs mt-1.5">Password is required</p>
            }
          </div>

        </div>

        <!-- Submit & Cancel Buttons -->
        <div class="flex gap-3 pt-2">
          <button
            type="submit"
            [disabled]="store.loading() || userForm.invalid"
            class="px-6 py-2.5 bg-white text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {{ store.loading() ? 'Saving...' : (isEdit() ? 'Update Account' : 'Create Account') }}
          </button>
          <a
            routerLink="/users"
            class="px-6 py-2.5 bg-zinc-800 text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </a>
        </div>
      </form>

    </div>
  `,
})
export class UserFormComponent implements OnInit {
  readonly store = inject(UsersStore);
  readonly suppliersStore = inject(SuppliersStore);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly isEdit = signal(false);
  private editId = signal<number | null>(null);

  form: CreateUserDto = {
    name: '',
    email: '',
    role: '',
    supplierId: undefined,
    password: '',
  };

  ngOnInit(): void {
    this.suppliersStore.loadSuppliers();
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.isEdit.set(true);
        this.editId.set(+id);
        this.api.getUser(+id).subscribe((user) => {
          this.form = {
            name: user.name,
            email: user.email,
            role: user.role,
            supplierId: user.supplierId,
            password: '',
          };
          this.cdr.detectChanges();
        });
      } else {
        this.isEdit.set(false);
        this.editId.set(null);
        this.form = {
          name: '',
          email: '',
          role: '',
          supplierId: undefined,
          password: '',
        };
        this.cdr.detectChanges();
      }
    });
  }

  submit(): void {
    const dto: any = { ...this.form };

    if (this.isEdit() && (!dto.password || dto.password.trim() === '')) {
      delete dto.password;
    }

    if (dto.role !== 'supplier') {
      delete dto.supplierId;
    } else if (dto.supplierId) {
      dto.supplierId = +dto.supplierId;
    }

    if (this.isEdit() && this.editId()) {
      this.store.updateUser({ id: this.editId()!, dto });
    } else {
      this.store.createUser(dto);
    }

    this.router.navigate(['/users']);
  }
}
