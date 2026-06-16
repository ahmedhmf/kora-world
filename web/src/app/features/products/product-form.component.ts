import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ProductsStore } from '../../store/products.store';
import { SuppliersStore } from '../../store/suppliers.store';
import { ApiService } from '../../core/services/api.service';
import { CreateProductDto, ProductCategory } from '../../core/models/product.model';


import { FileUploadComponent } from '../../shared/components/file-upload.component';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [FormsModule, RouterLink, FileUploadComponent],
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

      <!-- Sample Prefill Info Banner -->
      @if (fromSampleName()) {
        <div class="bg-zinc-900 border border-zinc-800 text-zinc-300 px-4 py-3.5 rounded-lg mb-6 text-sm flex items-center space-x-3">
          <svg class="h-5 w-5 text-zinc-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <span class="font-semibold text-white">Pre-filled from Sample:</span> {{ fromSampleName() }}.
            Please review the prefilled details and specify the production <span class="text-white font-semibold">Article Number</span> and <span class="text-white font-semibold">Unit Price</span>.
          </div>
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

          @if (!isEdit()) {
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Collection *</label>
              <select
                [(ngModel)]="form.collection" name="collection" required
                (change)="updateArticleNumberPreview()"
                class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500"
              >
                <option value="" disabled>Select collection</option>
                <option value="SS">SS (Spring/Summer)</option>
                <option value="FW">FW (Fall/Winter)</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Year *</label>
              <input
                [(ngModel)]="form.year" name="year" type="number" required
                (input)="updateArticleNumberPreview()"
                class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                placeholder="e.g. 2026"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Category *</label>
              <select
                [(ngModel)]="form.category" name="category" required
                (change)="updateArticleNumberPreview()"
                class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500"
              >
                <option [ngValue]="undefined" disabled>Select category</option>
                <option value="football">Football</option>
                <option value="handball">Handball</option>
                <option value="lifestyle">Lifestyle</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Article Number Preview</label>
              <input
                [value]="articleNumberPreview()"
                readonly
                disabled
                class="w-full bg-zinc-950 border border-zinc-800 text-zinc-400 rounded-lg px-4 py-2.5 text-sm select-all"
              />
            </div>

            @if (form.category === 'football' || form.category === 'handball') {
              <div>
                <label class="block text-sm font-medium text-zinc-400 mb-1.5">Pricepoint *</label>
                <select
                  [(ngModel)]="form.pricepoint" name="pricepoint" required
                  class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500"
                >
                  <option value="" disabled>Select pricepoint</option>
                  <option value="Club">Club</option>
                  <option value="Training">Training</option>
                  <option value="League">League</option>
                  <option value="Competition">Competition</option>
                  <option value="Match Pro">Match Pro</option>
                </select>
              </div>
            }
          } @else {
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Article Number</label>
              <input
                [value]="form.articleNumber"
                readonly
                disabled
                class="w-full bg-zinc-950 border border-zinc-800 text-zinc-400 rounded-lg px-4 py-2.5 text-sm"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Category</label>
              <select
                [(ngModel)]="form.category" name="category" disabled
                class="w-full bg-zinc-950 border border-zinc-800 text-zinc-400 rounded-lg px-4 py-2.5 text-sm focus:outline-none"
              >
                <option [ngValue]="undefined">Select category</option>
                <option value="football">Football</option>
                <option value="handball">Handball</option>
                <option value="lifestyle">Lifestyle</option>
              </select>
            </div>

            @if (form.category === 'football' || form.category === 'handball') {
              <div>
                <label class="block text-sm font-medium text-zinc-400 mb-1.5">Pricepoint *</label>
                <select
                  [(ngModel)]="form.pricepoint" name="pricepoint" required
                  class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500"
                >
                  <option value="" disabled>Select pricepoint</option>
                  <option value="Club">Club</option>
                  <option value="Training">Training</option>
                  <option value="League">League</option>
                  <option value="Competition">Competition</option>
                  <option value="Match Pro">Match Pro</option>
                </select>
              </div>
            }
          }

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
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Landing Price</label>
            <input
              [(ngModel)]="form.landingPrice" name="landingPrice" type="number" min="0" step="0.01"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              placeholder="0.00"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">1 PC Price</label>
            <input
              [(ngModel)]="form.onePcPrice" name="onePcPrice" type="number" min="0" step="0.01"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              placeholder="0.00"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Bulk Price</label>
            <input
              [(ngModel)]="form.bulkPrice" name="bulkPrice" type="number" min="0" step="0.01"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              placeholder="0.00"
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

          <!-- Tech Pack File (Optional) -->
          <div class="col-span-2 border-t border-zinc-800 pt-5 mt-2">
            <app-file-upload
              label="Digital Tech Pack Spec Sheet"
              [filePath]="form.techPackPath || ''"
              [fileName]="form.techPackName || ''"
              (fileUploaded)="onTechPackUploaded($event)"
              (fileRemoved)="onTechPackRemoved()"
            ></app-file-upload>
          </div>

          <!-- Product Photo (Optional) -->
          <div class="col-span-2 border-t border-zinc-800 pt-5 mt-2">
            <app-file-upload
              label="Product Photo"
              [filePath]="form.imagePath || ''"
              [fileName]="form.imageName || ''"
              (fileUploaded)="onProductPhotoUploaded($event)"
              (fileRemoved)="onProductPhotoRemoved()"
            ></app-file-upload>
          </div>

          <!-- Ball Construction Details (Football & Handball only) -->
          @if (form.category === 'football' || form.category === 'handball') {
            <div class="col-span-2 border-t border-zinc-800 pt-5 mt-2">
              <h3 class="text-sm font-semibold text-white mb-4">Construction Details</h3>
              <div class="grid grid-cols-2 gap-4">

                <div>
                  <label class="block text-xs font-medium text-zinc-400 mb-1.5">Backing</label>
                  <input
                    type="text" [(ngModel)]="ballConstruction.backing" name="backing"
                    placeholder="e.g. 4 layers poly-cotton"
                    class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                  />
                </div>

                <div>
                  <label class="block text-xs font-medium text-zinc-400 mb-1.5">Bladder</label>
                  <input
                    type="text" [(ngModel)]="ballConstruction.bladder" name="bladder"
                    placeholder="e.g. SR bladder, Latex bladder"
                    class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                  />
                </div>

                <div>
                  <label class="block text-xs font-medium text-zinc-400 mb-1.5">Cover Material</label>
                  <input
                    type="text" [(ngModel)]="ballConstruction.coverMaterial" name="coverMaterial"
                    placeholder="e.g. PU leather, TPU"
                    class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                  />
                </div>

                <div>
                  <label class="block text-xs font-medium text-zinc-400 mb-1.5">Cutting Die / Panels</label>
                  <input
                    type="number" step="0.01" [(ngModel)]="ballConstruction.cuttingDiePanels" name="cuttingDiePanels"
                    placeholder="e.g. 32.00"
                    class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                  />
                </div>

                <div>
                  <label class="block text-xs font-medium text-zinc-400 mb-1.5">Number of Colors</label>
                  <input
                    type="number" step="1" [(ngModel)]="ballConstruction.numberOfColors" name="numberOfColors"
                    placeholder="e.g. 3"
                    class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                  />
                </div>

                <div>
                  <label class="block text-xs font-medium text-zinc-400 mb-1.5">Bonding</label>
                  <select
                    [(ngModel)]="ballConstruction.bonding" name="bonding"
                    class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500"
                  >
                    <option value="">Select bonding</option>
                    <option value="machine stitched">Machine Stitched</option>
                    <option value="hand stitched">Hand Stitched</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="thermal bonding">Thermal Bonding</option>
                  </select>
                </div>

                <div class="col-span-2">
                  <label class="block text-xs font-medium text-zinc-400 mb-1.5">Carcass</label>
                  <input
                    type="text" [(ngModel)]="ballConstruction.carcass" name="carcass"
                    placeholder="e.g. Wound carcass"
                    class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                  />
                </div>

                <div class="flex items-center space-x-3 py-2">
                  <input
                    type="checkbox"
                    [(ngModel)]="ballConstruction.debossing"
                    name="debossing"
                    id="debossingCheckbox"
                    class="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <label for="debossingCheckbox" class="text-sm font-medium text-zinc-400 cursor-pointer select-none">
                    Debossing
                  </label>
                </div>

                <div class="flex items-center space-x-3 py-2">
                  <input
                    type="checkbox"
                    [(ngModel)]="ballConstruction.finishes"
                    name="finishes"
                    id="finishesCheckbox"
                    class="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <label for="finishesCheckbox" class="text-sm font-medium text-zinc-400 cursor-pointer select-none">
                    Finishes
                  </label>
                </div>

              </div>
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
  private readonly cdr = inject(ChangeDetectorRef);

  readonly isEdit = signal(false);
  private editId = signal<number | null>(null);
  readonly fromSampleName = signal<string | null>(null);
  readonly articleNumberPreview = signal<string>('Select collection, year, & category');

  form = {
    supplierId: 0,
    articleNumber: '',
    name: '',
    category: undefined as ProductCategory | undefined,
    description: '',
    unitPrice: 0,
    landingPrice: undefined as number | undefined,
    onePcPrice: undefined as number | undefined,
    bulkPrice: undefined as number | undefined,
    currency: '',
    moq: undefined as number | undefined,
    weightKg: undefined as number | undefined,
    techPackPath: '',
    techPackName: '',
    imagePath: '',
    imageName: '',
    collection: '',
    year: new Date().getFullYear(),
    pricepoint: '',
  };

  ballConstruction = {
    backing: '',
    bladder: '',
    coverMaterial: '',
    cuttingDiePanels: null as number | null,
    numberOfColors: null as number | null,
    bonding: '',
    debossing: false,
    finishes: false,
    carcass: ''
  };

  loadConstruction(construction?: Record<string, any>): void {
    if (!construction) return;
    this.ballConstruction = {
      backing: String(construction['Backing'] || ''),
      bladder: String(construction['Bladder'] || ''),
      coverMaterial: String(construction['Cover Material'] || ''),
      cuttingDiePanels: construction['Cutting Die / Panels'] ? parseFloat(String(construction['Cutting Die / Panels'])) : null,
      numberOfColors: construction['Number of Colors'] ? parseInt(String(construction['Number of Colors']), 10) : null,
      bonding: String(construction['Bonding'] || ''),
      debossing: construction['Debossing'] === 'Yes',
      finishes: construction['Finishes'] === 'Yes',
      carcass: String(construction['Carcass'] || '')
    };
  }

  serializeConstruction(): Record<string, string | number> | null {
    const obj: Record<string, string | number> = {};
    if (this.ballConstruction.backing) obj['Backing'] = this.ballConstruction.backing;
    if (this.ballConstruction.bladder) obj['Bladder'] = this.ballConstruction.bladder;
    if (this.ballConstruction.coverMaterial) obj['Cover Material'] = this.ballConstruction.coverMaterial;
    if (this.ballConstruction.cuttingDiePanels !== null) obj['Cutting Die / Panels'] = this.ballConstruction.cuttingDiePanels;
    if (this.ballConstruction.numberOfColors !== null) obj['Number of Colors'] = this.ballConstruction.numberOfColors;
    if (this.ballConstruction.bonding) obj['Bonding'] = this.ballConstruction.bonding;
    obj['Debossing'] = this.ballConstruction.debossing ? 'Yes' : 'No';
    obj['Finishes'] = this.ballConstruction.finishes ? 'Yes' : 'No';
    if (this.ballConstruction.carcass) obj['Carcass'] = this.ballConstruction.carcass;

    return Object.keys(obj).length > 0 ? obj : null;
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.isEdit.set(true);
        this.editId.set(+id);
        this.fromSampleName.set(null);
        forkJoin({
          suppliers: this.api.getSuppliers(),
          product: this.api.getProduct(+id)
        }).subscribe({
          next: ({ suppliers, product }) => {
            this.suppliersStore.setSuppliers(suppliers);
            this.form = {
              supplierId: product.supplierId,
              articleNumber: product.articleNumber,
              name: product.name,
              category: product.category,
              description: product.description || '',
              unitPrice: product.unitPrice,
              landingPrice: product.landingPrice,
              onePcPrice: product.onePcPrice,
              bulkPrice: product.bulkPrice,
              currency: product.currency || '',
              moq: product.moq,
              weightKg: product.weightKg,
              techPackPath: product.techPackPath || '',
              techPackName: product.techPackName || '',
              imagePath: product.imagePath || '',
              imageName: product.imageName || '',
              collection: product.collection || '',
              year: product.year || new Date().getFullYear(),
              pricepoint: product.pricepoint || '',
            };
            // Populate construction details
            this.loadConstruction(product.construction);
            this.cdr.detectChanges();
          },
          error: (err) => console.error('ProductForm: error loading data:', err)
        });
      } else {
        this.isEdit.set(false);
        this.editId.set(null);
        this.form = {
          supplierId: 0,
          articleNumber: '',
          name: '',
          category: undefined,
          description: '',
          unitPrice: 0,
          landingPrice: undefined,
          onePcPrice: undefined,
          bulkPrice: undefined,
          currency: '',
          moq: undefined,
          weightKg: undefined,
          techPackPath: '',
          techPackName: '',
          imagePath: '',
          imageName: '',
          collection: '',
          year: new Date().getFullYear(),
          pricepoint: '',
        };
        this.articleNumberPreview.set('Pending required fields...');
        this.ballConstruction = {
          backing: '',
          bladder: '',
          coverMaterial: '',
          cuttingDiePanels: null,
          numberOfColors: null,
          bonding: '',
          debossing: false,
          finishes: false,
          carcass: ''
        };

        this.api.getSuppliers().subscribe({
          next: (suppliers) => {
            this.suppliersStore.setSuppliers(suppliers);

            // Check if prefilling from a sample promotion
            const fromSampleId = this.route.snapshot.queryParamMap.get('fromSampleId');
            if (fromSampleId) {
              this.api.getSample(+fromSampleId).subscribe((sample) => {
                this.fromSampleName.set(sample.name);
                this.form = {
                  ...this.form,
                  supplierId: sample.supplierId,
                  name: sample.name,
                  category: sample.category,
                  techPackPath: sample.techPackPath || '',
                  techPackName: sample.techPackName || '',
                  imagePath: '',
                  imageName: '',
                  collection: sample.collection || '',
                  year: sample.year || new Date().getFullYear(),
                  pricepoint: '',
                };
                this.updateArticleNumberPreview();
                this.loadConstruction(sample.construction);
                this.cdr.detectChanges();
              });
            } else {
              this.cdr.detectChanges();
            }
          },
          error: (err) => console.error('ProductForm: error loading suppliers:', err)
        });
      }
    });
  }

  submit(): void {
    if (!this.form.name || !this.form.supplierId) return;
    if (!this.isEdit() && (!this.form.collection || !this.form.year || !this.form.category)) return;

    const dto = Object.fromEntries(
      Object.entries(this.form).filter(([_, v]) => v !== '' && v !== null && v !== undefined && v !== 0)
    ) as unknown as CreateProductDto;

    // supplierId must always be included
    dto.supplierId = this.form.supplierId;

    // Explicitly map numeric prices to bypass the "v !== 0" filter
    dto.unitPrice = this.form.unitPrice;
    if (this.form.landingPrice !== undefined && this.form.landingPrice !== null) {
      dto.landingPrice = this.form.landingPrice;
    }
    if (this.form.onePcPrice !== undefined && this.form.onePcPrice !== null) {
      dto.onePcPrice = this.form.onePcPrice;
    }
    if (this.form.bulkPrice !== undefined && this.form.bulkPrice !== null) {
      dto.bulkPrice = this.form.bulkPrice;
    }

    // Explicitly allow empty/null values for paths and names to allow removing them
    dto.techPackPath = this.form.techPackPath || null as any;
    dto.techPackName = this.form.techPackName || null as any;
    dto.imagePath = this.form.imagePath || null as any;
    dto.imageName = this.form.imageName || null as any;

    if (this.form.collection) dto.collection = this.form.collection;
    if (this.form.year) dto.year = this.form.year;

    // If category is not a ball, clear pricepoint
    if (this.form.category !== 'football' && this.form.category !== 'handball') {
      this.form.pricepoint = '';
    }
    dto.pricepoint = this.form.pricepoint || null as any;

    // Serialize construction if category is football or handball
    if (this.form.category === 'football' || this.form.category === 'handball') {
      dto.construction = this.serializeConstruction() as any;
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

  updateArticleNumberPreview(): void {
    const col = this.form.collection;
    const yr = this.form.year;
    const cat = this.form.category;

    if (!col || !yr || !cat) {
      this.articleNumberPreview.set('Pending required fields...');
      return;
    }

    const yearStr = String(yr).slice(-2);
    let catCode = 'OTH';
    if (cat === 'football') catCode = 'FB';
    else if (cat === 'handball') catCode = 'HB';
    else if (cat === 'lifestyle') catCode = 'APP';

    this.api.getProductNextCounter(col, yr, cat).subscribe({
      next: (res) => {
        const counterStr = String(res.counter).padStart(4, '0');
        this.articleNumberPreview.set(`${col}${yearStr}${counterStr}${catCode}`);
      },
      error: () => {
        this.articleNumberPreview.set(`${col}${yearStr}??${catCode}`);
      }
    });
  }

  onTechPackUploaded(file: { path: string; name: string }): void {
    this.form.techPackPath = file.path;
    this.form.techPackName = file.name;
  }

  onTechPackRemoved(): void {
    this.form.techPackPath = '';
    this.form.techPackName = '';
  }

  onProductPhotoUploaded(file: { path: string; name: string }): void {
    this.form.imagePath = file.path;
    this.form.imageName = file.name;
  }

  onProductPhotoRemoved(): void {
    this.form.imagePath = '';
    this.form.imageName = '';
  }
}
