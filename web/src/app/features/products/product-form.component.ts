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
    graphicLogoPath: '',
    graphicLogoName: '',
    graphicPatternPath: '',
    graphicPatternName: '',
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
    carcass: '',
    circumference: '',
    weight: '',
    pressure: '',
    rebound: '',
    waterAbsorption: '',
    shapeSizeRetention: '',
  };

  graphicPoints = {
    colorCallouts: { path: '', name: '', notes: '' },
    logoPlacement: { path: '', name: '', notes: '' },
    printMethod: { path: '', name: '', notes: '' },
    printColors: { path: '', name: '', notes: '' },
    logoVector: { path: '', name: '', notes: '' },
    labelBadge: { path: '', name: '', notes: '' },
    ballColor: { path: '', name: '', notes: '' },
    patternLayout: { path: '', name: '', notes: '' },
  };

  packagingSpecs = {
    individualPackaging: '',
    inflationState: '',
    boxDimensions: '',
    unitsPerCarton: null as number | null,
    koraBrandingOnBox: false,
    koraBrandingArtwork: { path: '', name: '' },
    barcodeEan: '',
    barcodeEanFile: { path: '', name: '' },
  };

  qualitySpecs = {
    preProductionSamples: '',
    aqlInspectionLevel: '',
    rejectionCriteria: '',
    referenceStandard: '',
    thirdPartyTestingLab: '',
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
      carcass: String(construction['Carcass'] || ''),
      circumference: String(construction['Circumference'] || ''),
      weight: String(construction['Weight'] || ''),
      pressure: String(construction['Pressure'] || ''),
      rebound: String(construction['Rebound'] || ''),
      waterAbsorption: String(construction['Water absorption'] || construction['Water Absorption'] || ''),
      shapeSizeRetention: String(construction['Shape/size retention'] || construction['Shape/Size Retention'] || ''),
    };

    const g = construction['GraphicPoints'] || {};
    this.graphicPoints = {
      colorCallouts: g['colorCallouts'] || { path: '', name: '', notes: '' },
      logoPlacement: g['logoPlacement'] || { path: '', name: '', notes: '' },
      printMethod: g['printMethod'] || { path: '', name: '', notes: '' },
      printColors: g['printColors'] || { path: '', name: '', notes: '' },
      logoVector: g['logoVector'] || { path: '', name: '', notes: '' },
      labelBadge: g['labelBadge'] || { path: '', name: '', notes: '' },
      ballColor: g['ballColor'] || { path: '', name: '', notes: '' },
      patternLayout: g['patternLayout'] || { path: '', name: '', notes: '' },
    };

    const p = construction['PackagingSpecs'] || {};
    this.packagingSpecs = {
      individualPackaging: String(p['individualPackaging'] || ''),
      inflationState: String(p['inflationState'] || ''),
      boxDimensions: String(p['boxDimensions'] || ''),
      unitsPerCarton: p['unitsPerCarton'] !== undefined && p['unitsPerCarton'] !== null ? Number(p['unitsPerCarton']) : null,
      koraBrandingOnBox: p['koraBrandingOnBox'] === true || p['koraBrandingOnBox'] === 'Yes',
      koraBrandingArtwork: p['koraBrandingArtwork'] || { path: '', name: '' },
      barcodeEan: String(p['barcodeEan'] || ''),
      barcodeEanFile: p['barcodeEanFile'] || { path: '', name: '' },
    };

    const q = construction['QualitySpecs'] || {};
    this.qualitySpecs = {
      preProductionSamples: String(q['preProductionSamples'] || ''),
      aqlInspectionLevel: String(q['aqlInspectionLevel'] || ''),
      rejectionCriteria: String(q['rejectionCriteria'] || ''),
      referenceStandard: String(q['referenceStandard'] || ''),
      thirdPartyTestingLab: String(q['thirdPartyTestingLab'] || ''),
    };
  }

  serializeConstruction(): Record<string, any> | null {
    const obj: Record<string, any> = {};
    if (this.ballConstruction.backing) obj['Backing'] = this.ballConstruction.backing;
    if (this.ballConstruction.bladder) obj['Bladder'] = this.ballConstruction.bladder;
    if (this.ballConstruction.coverMaterial) obj['Cover Material'] = this.ballConstruction.coverMaterial;
    if (this.ballConstruction.cuttingDiePanels !== null) obj['Cutting Die / Panels'] = this.ballConstruction.cuttingDiePanels;
    if (this.ballConstruction.numberOfColors !== null) obj['Number of Colors'] = this.ballConstruction.numberOfColors;
    if (this.ballConstruction.bonding) obj['Bonding'] = this.ballConstruction.bonding;
    obj['Debossing'] = this.ballConstruction.debossing ? 'Yes' : 'No';
    obj['Finishes'] = this.ballConstruction.finishes ? 'Yes' : 'No';
    if (this.ballConstruction.carcass) obj['Carcass'] = this.ballConstruction.carcass;
    if (this.ballConstruction.circumference) obj['Circumference'] = this.ballConstruction.circumference;
    if (this.ballConstruction.weight) obj['Weight'] = this.ballConstruction.weight;
    if (this.ballConstruction.pressure) obj['Pressure'] = this.ballConstruction.pressure;
    if (this.ballConstruction.rebound) obj['Rebound'] = this.ballConstruction.rebound;
    if (this.ballConstruction.waterAbsorption) obj['Water absorption'] = this.ballConstruction.waterAbsorption;
    if (this.ballConstruction.shapeSizeRetention) obj['Shape/size retention'] = this.ballConstruction.shapeSizeRetention;
    
    obj['GraphicPoints'] = this.graphicPoints;
    obj['PackagingSpecs'] = this.packagingSpecs;
    obj['QualitySpecs'] = this.qualitySpecs;
    return Object.keys(obj).length > 0 ? obj : null;
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['fromSample']) {
        this.fromSampleName.set(params['fromSample']);
      }
    });

    this.route.params.subscribe((params) => {
      if (params['id']) {
        this.isEdit.set(true);
        this.editId.set(+params['id']);
        forkJoin({
          suppliers: this.api.getSuppliers(),
          product: this.api.getProduct(+params['id']),
          options: this.dropdownService.getOptions()
        }).subscribe({
          next: ({ suppliers, product, options }) => {
            this.suppliersStore.setSuppliers(suppliers);
            const filterVals = (cat: string) => options.filter(o => o.category === cat).map(o => o.value);
            this.currencies.set(filterVals('currency'));
            this.backings.set(filterVals('backing'));
            this.bladders.set(filterVals('bladder'));
            this.coverMaterials.set(filterVals('coverMaterial'));
            this.bondings.set(filterVals('bonding'));
            this.pricepoints.set(filterVals('pricepoint'));

            if (product) {
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
                graphicLogoPath: product.graphicLogoPath || '',
                graphicLogoName: product.graphicLogoName || '',
                graphicPatternPath: product.graphicPatternPath || '',
                graphicPatternName: product.graphicPatternName || '',
                collection: product.collection || '',
                year: product.year || new Date().getFullYear(),
                pricepoint: product.pricepoint || '',
              };
              this.loadConstruction(product.construction);
              this.cdr.detectChanges();
            }
          },
          error: (err) => console.error('ProductForm: error loading edit product:', err)
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
          graphicLogoPath: '',
          graphicLogoName: '',
          graphicPatternPath: '',
          graphicPatternName: '',
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
          carcass: '',
          circumference: '',
          weight: '',
          pressure: '',
          rebound: '',
          waterAbsorption: '',
          shapeSizeRetention: '',
        };
        this.graphicPoints = {
          colorCallouts: { path: '', name: '', notes: '' },
          logoPlacement: { path: '', name: '', notes: '' },
          printMethod: { path: '', name: '', notes: '' },
          printColors: { path: '', name: '', notes: '' },
          logoVector: { path: '', name: '', notes: '' },
          labelBadge: { path: '', name: '', notes: '' },
          ballColor: { path: '', name: '', notes: '' },
          patternLayout: { path: '', name: '', notes: '' },
        };
        this.packagingSpecs = {
          individualPackaging: '',
          inflationState: '',
          boxDimensions: '',
          unitsPerCarton: null,
          koraBrandingOnBox: false,
          koraBrandingArtwork: { path: '', name: '' },
          barcodeEan: '',
          barcodeEanFile: { path: '', name: '' },
        };
        this.qualitySpecs = {
          preProductionSamples: '',
          aqlInspectionLevel: '',
          rejectionCriteria: '',
          referenceStandard: '',
          thirdPartyTestingLab: '',
        };

        forkJoin({
          suppliers: this.api.getSuppliers(),
          options: this.dropdownService.getOptions()
        }).subscribe({
          next: ({ suppliers, options }) => {
            this.suppliersStore.setSuppliers(suppliers);
            const filterVals = (cat: string) => options.filter(o => o.category === cat).map(o => o.value);
            this.currencies.set(filterVals('currency'));
            this.backings.set(filterVals('backing'));
            this.bladders.set(filterVals('bladder'));
            this.coverMaterials.set(filterVals('coverMaterial'));
            this.bondings.set(filterVals('bonding'));
            this.pricepoints.set(filterVals('pricepoint'));

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
                  graphicLogoPath: product.graphicLogoPath || '',
                  graphicLogoName: product.graphicLogoName || '',
                  graphicPatternPath: product.graphicPatternPath || '',
                  graphicPatternName: product.graphicPatternName || '',
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
    dto.graphicLogoPath = this.form.graphicLogoPath || null as any;
    dto.graphicLogoName = this.form.graphicLogoName || null as any;
    dto.graphicPatternPath = this.form.graphicPatternPath || null as any;
    dto.graphicPatternName = this.form.graphicPatternName || null as any;

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

  onGraphicLogoUploaded(file: { path: string; name: string }): void {
    this.form.graphicLogoPath = file.path;
    this.form.graphicLogoName = file.name;
    this.cdr.detectChanges();
  }

  onGraphicLogoRemoved(): void {
    this.form.graphicLogoPath = '';
    this.form.graphicLogoName = '';
    this.cdr.detectChanges();
  }

  onGraphicPatternUploaded(file: { path: string; name: string }): void {
    this.form.graphicPatternPath = file.path;
    this.form.graphicPatternName = file.name;
    this.cdr.detectChanges();
  }

  onGraphicPatternRemoved(): void {
    this.form.graphicPatternPath = '';
    this.form.graphicPatternName = '';
    this.cdr.detectChanges();
  }

  onPointFileUploaded(key: keyof typeof this.graphicPoints, file: { path: string; name: string }): void {
    this.graphicPoints[key].path = file.path;
    this.graphicPoints[key].name = file.name;
    this.cdr.detectChanges();
  }

  onPointFileRemoved(key: keyof typeof this.graphicPoints): void {
    this.graphicPoints[key].path = '';
    this.graphicPoints[key].name = '';
    this.cdr.detectChanges();
  }

  onBrandingArtworkUploaded(file: { path: string; name: string }): void {
    this.packagingSpecs.koraBrandingArtwork.path = file.path;
    this.packagingSpecs.koraBrandingArtwork.name = file.name;
    this.cdr.detectChanges();
  }

  onBrandingArtworkRemoved(): void {
    this.packagingSpecs.koraBrandingArtwork.path = '';
    this.packagingSpecs.koraBrandingArtwork.name = '';
    this.cdr.detectChanges();
  }

  onBarcodeFileUploaded(file: { path: string; name: string }): void {
    this.packagingSpecs.barcodeEanFile.path = file.path;
    this.packagingSpecs.barcodeEanFile.name = file.name;
    this.cdr.detectChanges();
  }

  onBarcodeFileRemoved(): void {
    this.packagingSpecs.barcodeEanFile.path = '';
    this.packagingSpecs.barcodeEanFile.name = '';
    this.cdr.detectChanges();
  }
}
