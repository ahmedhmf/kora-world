import { ChangeDetectorRef, Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { B2cRequestsStore } from '../../store/b2c-requests.store';
import { ApiService } from '../../core/services/api.service';
import { Product } from '../../core/models/product.model';
import { CreateB2cRequestDto, B2cChannelType, B2cStatusType } from '../../core/models/b2c-request.model';

@Component({
  selector: 'app-b2c-request-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="p-8 max-w-2xl mx-auto">

      <!-- Header -->
      <div class="mb-8">
        <a routerLink="/b2c-requests" class="text-zinc-500 hover:text-zinc-300 text-sm mb-4 inline-block transition-colors">← Back to Requests</a>
        <h1 class="text-2xl font-bold text-white">{{ isEdit() ? 'Edit Request Details' : 'Record Customer Request' }}</h1>
        <p class="text-zinc-400 text-sm mt-1">Log B2C incoming request details so you can contact them when stock arrives.</p>
      </div>

      <!-- Error Message -->
      @if (store.error()) {
        <div class="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
          {{ store.error() }}
        </div>
      }

      <!-- Form -->
      <form #requestForm="ngForm" (ngSubmit)="requestForm.valid && submit()" class="space-y-6">
        
        <!-- Section: Customer Info -->
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 space-y-5">
          <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 font-mono">Customer Details</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <!-- Customer Name -->
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Customer Name *</label>
              <input
                [(ngModel)]="form.customerName" name="customerName" required #nameInput="ngModel"
                class="w-full bg-zinc-950 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-650 transition-colors"
                [class.border-zinc-700]="!nameInput.invalid || (!nameInput.dirty && !nameInput.touched)"
                [class.border-red-500]="nameInput.invalid && (nameInput.dirty || nameInput.touched)"
                placeholder="Customer full name or profile name"
              />
              @if (nameInput.invalid && (nameInput.dirty || nameInput.touched)) {
                <p class="text-red-500 text-xs mt-1.5">Customer name is required</p>
              }
            </div>

            <!-- Inquiry Channel -->
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Inquiry Channel *</label>
              <select
                [(ngModel)]="form.channel" name="channel" required #channelInput="ngModel"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 appearance-none"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="other">Other</option>
              </select>
            </div>

            <!-- Username / Handle -->
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Channel Handle / Username</label>
              <input
                [(ngModel)]="form.channelUsername" name="channelUsername"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 transition-colors"
                placeholder="e.g. @john_doe"
              />
            </div>

            <!-- Phone Number -->
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Phone Number</label>
              <input
                [(ngModel)]="form.phone" name="phone"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 transition-colors font-mono"
                placeholder="e.g. +123456789"
              />
            </div>

            <!-- Email -->
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Email Address</label>
              <input
                [(ngModel)]="form.email" name="email" type="email" #emailInput="ngModel"
                class="w-full bg-zinc-950 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 transition-colors"
                [class.border-zinc-700]="!emailInput.invalid"
                [class.border-red-500]="emailInput.invalid"
                placeholder="customer@domain.com"
              />
            </div>

          </div>
        </div>

        <!-- Section: Requested Item -->
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 space-y-5">
          <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 font-mono">Inquiry Details</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <!-- Product Autocomplete Picker -->
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Requested Product</label>
              <div class="relative">
                <input
                  type="text"
                  [(ngModel)]="productSearch"
                  (ngModelChange)="onProductSearchChange($event)"
                  [placeholder]="selectedProduct() ? (selectedProduct()!.articleNumber + ' – ' + selectedProduct()!.name) : 'Search catalog products...'"
                  name="productSearch"
                  class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-500"
                  autocomplete="off"
                />
                @if (showProductDropdown() && filteredProducts().length > 0) {
                  <div class="absolute left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 max-h-56 overflow-y-auto">
                    @for (prod of filteredProducts(); track prod.id) {
                      <button type="button" (click)="selectProduct(prod)"
                        class="w-full text-left px-4 py-2.5 hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-0">
                        <div class="text-white text-sm font-medium">{{ prod.name }}</div>
                        <div class="text-zinc-500 text-xs font-mono">{{ prod.articleNumber }} · Price: {{ prod.unitPrice | currency }}</div>
                      </button>
                    }
                  </div>
                }
              </div>
              @if (selectedProduct()) {
                <div class="mt-2 flex items-center gap-2 bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2">
                  <span class="text-xs text-white font-semibold">Selected Product:</span>
                  <span class="text-zinc-200 text-xs font-semibold font-mono">{{ selectedProduct()!.articleNumber }}</span>
                  <span class="text-zinc-400 text-xs truncate">— {{ selectedProduct()!.name }}</span>
                  <button type="button" (click)="clearProduct()" class="ml-auto text-zinc-500 hover:text-zinc-300 transition-colors text-xs">✕</button>
                </div>
              }
            </div>

            <!-- Size Requested -->
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Requested Size</label>
              <input
                [(ngModel)]="form.requestedSize" name="requestedSize"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 transition-colors"
                placeholder="e.g. XL, 42, 5"
              />
            </div>

            <!-- Color Requested -->
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Requested Color</label>
              <input
                [(ngModel)]="form.requestedColor" name="requestedColor"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 transition-colors"
                placeholder="e.g. Royal Blue"
              />
            </div>

            <!-- Quantity -->
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Quantity</label>
              <input
                [(ngModel)]="form.quantity" name="quantity" type="number" min="1" required
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 font-mono"
              />
            </div>

            <!-- Status (Only shown on Edit) -->
            @if (isEdit()) {
              <div>
                <label class="block text-sm font-medium text-zinc-400 mb-1.5">Status</label>
                <select
                  [(ngModel)]="form.status" name="status"
                  class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 appearance-none"
                >
                  <option value="pending">Pending Notification</option>
                  <option value="notified">Notified</option>
                  <option value="fulfilled">Fulfilled</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            }

            <!-- Notes -->
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Customer Notes / Request details</label>
              <textarea
                [(ngModel)]="form.notes" name="notes" rows="3"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-650 resize-none"
                placeholder="Additional inquiries, comments, or special delivery/social request links..."
              ></textarea>
            </div>

          </div>
        </div>

        <!-- Submit & Cancel -->
        <div class="flex gap-3 pt-2 pb-8">
          <button
            type="submit"
            [disabled]="store.loading() || requestForm.invalid"
            class="px-6 py-2.5 bg-white text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ store.loading() ? 'Saving...' : (isEdit() ? 'Update Details' : 'Record Request') }}
          </button>
          <a
            routerLink="/b2c-requests"
            class="px-6 py-2.5 bg-zinc-800 text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </a>
        </div>

      </form>
    </div>
  `,
})
export class B2cRequestFormComponent implements OnInit {
  readonly store = inject(B2cRequestsStore);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly isEdit = signal(false);
  private editId = signal<number | null>(null);

  // Form State
  form: Partial<CreateB2cRequestDto> = {
    customerName: '',
    channel: 'instagram',
    channelUsername: '',
    phone: '',
    email: '',
    requestedSize: '',
    requestedColor: '',
    quantity: 1,
    status: 'pending',
    notes: '',
  };

  // Product autocomplete selection state
  allProducts: Product[] = [];
  productSearch = '';
  showProductDropdown = signal(false);
  selectedProduct = signal<Product | null>(null);

  filteredProducts = computed(() => {
    const q = this.productSearch.toLowerCase().trim();
    if (!q) return this.allProducts.slice(0, 8);
    return this.allProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.articleNumber.toLowerCase().includes(q)
    ).slice(0, 8);
  });

  ngOnInit(): void {
    // Load product catalogue for search autocomplete
    this.api.getProducts().subscribe({ next: (prods) => (this.allProducts = prods) });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.isEdit.set(true);
        this.editId.set(+id);
        this.api.getB2cRequest(+id).subscribe({
          next: (req) => {
            this.form = {
              customerName: req.customerName,
              channel: req.channel,
              channelUsername: req.channelUsername || '',
              phone: req.phone || '',
              email: req.email || '',
              requestedSize: req.requestedSize || '',
              requestedColor: req.requestedColor || '',
              quantity: req.quantity,
              status: req.status,
              notes: req.notes || '',
            };
            if (req.product) {
              this.selectedProduct.set(req.product as Product);
            }
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('B2cRequestForm: error fetching request:', err);
          }
        });
      } else {
        this.isEdit.set(false);
        this.editId.set(null);
        this.form = {
          customerName: '',
          channel: 'instagram',
          channelUsername: '',
          phone: '',
          email: '',
          requestedSize: '',
          requestedColor: '',
          quantity: 1,
          status: 'pending',
          notes: '',
        };
        this.cdr.detectChanges();
      }
    });
  }

  onProductSearchChange(q: string): void {
    this.showProductDropdown.set(q.length > 0);
  }

  selectProduct(prod: Product): void {
    this.selectedProduct.set(prod);
    this.showProductDropdown.set(false);
    this.productSearch = '';
  }

  clearProduct(): void {
    this.selectedProduct.set(null);
    this.productSearch = '';
  }

  submit(): void {
    if (!this.form.customerName) return;

    const dto: CreateB2cRequestDto = {
      customerName: this.form.customerName,
      channel: this.form.channel as B2cChannelType,
      channelUsername: this.form.channelUsername || undefined,
      phone: this.form.phone || undefined,
      email: this.form.email || undefined,
      productId: this.selectedProduct() ? this.selectedProduct()!.id : undefined,
      requestedSize: this.form.requestedSize || undefined,
      requestedColor: this.form.requestedColor || undefined,
      quantity: this.form.quantity ? +this.form.quantity : 1,
      status: this.form.status as B2cStatusType,
      notes: this.form.notes || undefined,
    };

    const navigateBack = () => this.router.navigate(['/b2c-requests']);

    if (this.isEdit() && this.editId()) {
      this.store.updateRequest({ id: this.editId()!, dto, callback: navigateBack });
    } else {
      this.store.createRequest({ dto, callback: navigateBack });
    }
  }
}
