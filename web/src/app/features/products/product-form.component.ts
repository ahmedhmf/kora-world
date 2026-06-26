import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ProductsStore } from '../../store/products.store';
import { SuppliersStore } from '../../store/suppliers.store';
import { ApiService } from '../../core/services/api.service';
import { CreateProductDto, ProductCategory } from '../../core/models/product.model';


import { FileUploadComponent } from '../../shared/components/file-upload.component';
import { DropdownOptionsService } from '../../core/services/dropdown-options.service';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [FormsModule, RouterLink, FileUploadComponent],
  templateUrl: './product-form.component.html',
})
export class ProductFormComponent implements OnInit {
  readonly store = inject(ProductsStore);
  readonly suppliersStore = inject(SuppliersStore);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dropdownService = inject(DropdownOptionsService);

  readonly currencies = signal<string[]>([]);
  readonly backings = signal<string[]>([]);
  readonly bladders = signal<string[]>([]);
  readonly coverMaterials = signal<string[]>([]);
  readonly bondings = signal<string[]>([]);
  readonly pricepoints = signal<string[]>([]);

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
    this.dropdownService.getOptions().subscribe({
      next: (opts) => {
        const filterVals = (cat: string) => opts.filter(o => o.category === cat).map(o => o.value);
        this.currencies.set(filterVals('currency'));
        this.backings.set(filterVals('backing'));
        this.bladders.set(filterVals('bladder'));
        this.coverMaterials.set(filterVals('coverMaterial'));
        this.bondings.set(filterVals('bonding'));
        this.pricepoints.set(filterVals('pricepoint'));
        this.cdr.detectChanges();
      },
      error: (err) => console.error('ProductForm: error loading dropdown options:', err)
    });

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

             // Check if prefilling from a sample promotion or copyFrom
            const fromSampleId = this.route.snapshot.queryParamMap.get('fromSampleId');
            const copyFromId = this.route.snapshot.queryParamMap.get('copyFrom');
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
            } else if (copyFromId) {
              this.api.getProduct(+copyFromId).subscribe((product) => {
                this.form = {
                  ...this.form,
                  supplierId: product.supplierId,
                  name: `${product.name} (Copy)`,
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
                this.updateArticleNumberPreview();
                this.loadConstruction(product.construction);
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
    this.cdr.detectChanges();
  }

  onTechPackRemoved(): void {
    this.form.techPackPath = '';
    this.form.techPackName = '';
    this.cdr.detectChanges();
  }

  onProductPhotoUploaded(file: { path: string; name: string }): void {
    this.form.imagePath = file.path;
    this.form.imageName = file.name;
    this.cdr.detectChanges();
  }

  onProductPhotoRemoved(): void {
    this.form.imagePath = '';
    this.form.imageName = '';
    this.cdr.detectChanges();
  }
}
