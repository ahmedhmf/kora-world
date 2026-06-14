import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductsStore } from '../../store/products.store';
import { SuppliersStore } from '../../store/suppliers.store';
import { ApiService } from '../../core/services/api.service';
import { CreateProductDto } from '../../core/models/product.model';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="p-8 max-w-2xl">

      <!-- Header -->
      <div class="mb-8">
        <a routerLink="/products" class="text-zinc-500 hover:text-zinc-300 text-sm mb-4 inline-block">← Back to Products</a>
        <h1 class="text-2xl font-bold text-white">{{ isEdit() ? 'Edit Product' : 'New Product' }}</h1>
      </div>

      <!-- Error -->
      @if (store.error()) {
        <div class="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
          {{ store.error() }}
        </div>
      }

      <form (ngSubmit)="submit()" class="space-y-5">
        <div class="grid grid-cols-2 gap-5">

          <div class="col-span-2">
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Supplier *</label>
            <select
              [(ngModel)]="form.supplierId" name="supplierId" required
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500"
            >
              <option [ngValue]="0" disabled>Select a supplier</option>
              @for (s of suppliersStore.suppliers(); track s.id) {
                <option [ngValue]="s.id">{{ s.name }}</option>
              }
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Article Number *</label>
            <input
              [(ngModel)]="form.articleNumber" name="articleNumber" required
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              placeholder="e.g. KOR-FB-001"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Category</label>
            <select
              [(ngModel)]="form.category" name="category"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500"
            >
              <option [ngValue]="undefined">Select category</option>
              <option value="football">Football</option>
              <option value="handball">Handball</option>
              <option value="lifestyle">Lifestyle</option>
            </select>
          </div>

          <div class="col-span-2">
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Product Name *</label>
            <input
              [(ngModel)]="form.name" name="name" required
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              placeholder="e.g. Kora Match Pro Football Size 5"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Unit Price *</label>
            <input
              [(ngModel)]="form.unitPrice" name="unitPrice" type="number" min="0" step="0.01" required
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              placeholder="0.00"
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
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">MOQ</label>
            <input
              [(ngModel)]="form.moq" name="moq" type="number" min="1"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              placeholder="Minimum order quantity"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Weight (kg)</label>
            <input
              [(ngModel)]="form.weightKg" name="weightKg" type="number" min="0" step="0.01"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              placeholder="0.00"
            />
          </div>

          <div class="col-span-2">
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Description</label>
            <textarea
              [(ngModel)]="form.description" name="description" rows="3"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 resize-none"
              placeholder="Product details, specifications..."
            ></textarea>
          </div>

          <!-- Construction Details (Only for Balls - Football/Handball) -->
          @if (form.category === 'football' || form.category === 'handball') {
            <div class="col-span-2 border-t border-zinc-800 pt-5 mt-2">
              <div class="flex justify-between items-center mb-4">
                <div>
                  <h3 class="text-sm font-semibold text-white">Construction Details</h3>
                  <p class="text-zinc-500 text-xs mt-0.5">Specify panels, stitching type, bladder, or outer material.</p>
                </div>
                <button
                  type="button"
                  (click)="addConstructionPair()"
                  class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-md transition-colors"
                >
                  + Add Detail
                </button>
              </div>

              @for (pair of constructionPairs; track $index) {
                <div class="flex gap-3 mb-3 items-center">
                  <input
                    type="text"
                    [(ngModel)]="pair.key"
                    [name]="'constKey_' + $index"
                    required
                    placeholder="Specification (e.g. Panels, Bladder)"
                    class="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                  />
                  <input
                    type="text"
                    [(ngModel)]="pair.value"
                    [name]="'constVal_' + $index"
                    required
                    placeholder="Value (e.g. 32, Latex bladder)"
                    class="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                  />
                  <button
                    type="button"
                    (click)="removeConstructionPair($index)"
                    class="text-red-400 hover:text-red-300 text-xs font-semibold px-2 py-1.5 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              } @empty {
                <div class="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-lg p-6 text-center">
                  <p class="text-zinc-500 text-xs">No construction details added yet.</p>
                  <button
                    type="button"
                    (click)="addConstructionPair()"
                    class="text-white hover:underline text-xs font-medium mt-1 inline-block"
                  >
                    Add the first specification
                  </button>
                </div>
              }
            </div>
          }

        </div>

        <div class="flex gap-3 pt-2">
          <button
            type="submit"
            [disabled]="store.loading()"
            class="px-6 py-2.5 bg-white text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50"
          >
            {{ store.loading() ? 'Saving...' : (isEdit() ? 'Update Product' : 'Create Product') }}
          </button>
          <a
            routerLink="/products"
            class="px-6 py-2.5 bg-zinc-800 text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  `,
})
export class ProductFormComponent implements OnInit {
  readonly store = inject(ProductsStore);
  readonly suppliersStore = inject(SuppliersStore);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly isEdit = signal(false);
  private editId = signal<number | null>(null);

  constructionPairs: { key: string; value: string }[] = [];

  form: CreateProductDto = {
    supplierId: 0,
    articleNumber: '',
    name: '',
    category: undefined,
    description: '',
    unitPrice: 0,
    currency: '',
    moq: undefined,
    weightKg: undefined,
  };

  addConstructionPair(): void {
    this.constructionPairs.push({ key: '', value: '' });
  }

  removeConstructionPair(index: number): void {
    this.constructionPairs.splice(index, 1);
  }

  ngOnInit(): void {
    this.suppliersStore.loadSuppliers();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.editId.set(+id);
      this.api.getProduct(+id).subscribe((product) => {
        this.form = {
          supplierId: product.supplierId,
          articleNumber: product.articleNumber,
          name: product.name,
          category: product.category,
          description: product.description,
          unitPrice: product.unitPrice,
          currency: product.currency,
          moq: product.moq,
          weightKg: product.weightKg,
        };
        // Populate construction pairs
        this.constructionPairs = Object.entries(product.construction || {}).map(
          ([key, value]) => ({ key, value })
        );
      });
    }
  }

  submit(): void {
    if (!this.form.name || !this.form.articleNumber || !this.form.supplierId) return;

    const dto = Object.fromEntries(
      Object.entries(this.form).filter(([_, v]) => v !== '' && v !== null && v !== undefined && v !== 0)
    ) as CreateProductDto;

    // supplierId must always be included
    dto.supplierId = this.form.supplierId;

    // Serialize construction pairs if category is football or handball
    if (this.form.category === 'football' || this.form.category === 'handball') {
      const constructionObj: Record<string, string> = {};
      for (const pair of this.constructionPairs) {
        if (pair.key.trim()) {
          constructionObj[pair.key.trim()] = pair.value;
        }
      }
      dto.construction = Object.keys(constructionObj).length > 0 ? constructionObj : (null as any);
    } else {
      dto.construction = null as any;
    }

    if (this.isEdit() && this.editId()) {
      this.store.updateProduct({ id: this.editId()!, dto });
    } else {
      this.store.createProduct(dto);
    }

    this.router.navigate(['/products']);
  }
}
