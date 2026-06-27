import { Component, OnInit, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { DropdownOptionsService } from '../../core/services/dropdown-options.service';
import { Product } from '../../core/models/product.model';

import { FileUploadComponent } from '../../shared/components/file-upload.component';

@Component({
  selector: 'app-tech-pack-creator',
  standalone: true,
  imports: [CommonModule, FormsModule, FileUploadComponent],
  templateUrl: './tech-pack-creator.component.html',
  styles: [`
    @media print {
      body * {
        visibility: hidden;
      }
      #printable-tech-pack, #printable-tech-pack * {
        visibility: visible;
      }
      #printable-tech-pack {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        margin: 0;
        padding: 0;
      }
      .page-break {
        page-break-after: always;
        break-after: page;
        box-shadow: none !important;
        border: none !important;
        border-radius: 0 !important;
      }
      .no-print {
        display: none !important;
      }
      @page {
        size: A4 portrait;
        margin: 0;
      }
    }
  `]
})
export class TechPackCreatorComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly dropdownService = inject(DropdownOptionsService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly products = signal<Product[]>([]);
  readonly loading = signal(false);

  // Dropdown signals
  readonly backings = signal<string[]>([]);
  readonly bladders = signal<string[]>([]);
  readonly coverMaterials = signal<string[]>([]);
  readonly bondings = signal<string[]>([]);
  readonly pricepoints = signal<string[]>([]);

  selectedProductId: number | null = null;

  // Document Page 1 Data
  productHeader = {
    name: '',
    articleNumber: '',
    collection: '',
    year: new Date().getFullYear(),
    category: 'football',
    pricepoint: '',
    supplierName: '',
    imagePath: '',
    imageName: '',
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
    // Outer Cover (Casing)
    casingMaterialTier: '',
    casingFinish: '',
    casingThickness: '',
    panelCountShape: '',
    constructionMethod: '',
    // Lining Layers
    liningLayers: '',
    // Bladder Details
    bladderMaterialType: '',
    valveType: '',
    // Dimensions & Physical Specs (Page 3)
    circumference: '',
    physicalWeight: '',
    pressure: '',
    rebound: '',
    waterAbsorption: '',
    shapeSizeRetention: '',
  };

  graphicPoints = {
    colorCallouts: { title: '1. Color Callouts (Pantone Codes)', path: '', name: '', notes: '' },
    logoPlacement: { title: '2. Logo Placement & Position', path: '', name: '', notes: '' },
    printMethod: { title: '3. Print Method', path: '', name: '', notes: '' },
    printColors: { title: '4. Print Colors (CMYK + Pantone)', path: '', name: '', notes: '' },
    logoVector: { title: '5. Logo Vector File', path: '', name: '', notes: '' },
    labelBadge: { title: '6. Label / Badge (Quality Mark)', path: '', name: '', notes: '' },
    ballColor: { title: '7. Ball Color (Background Panel)', path: '', name: '', notes: '' },
    patternLayout: { title: '8. Pattern & Flat Panel Net Layout', path: '', name: '', notes: '' },
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

  ngOnInit(): void {
    this.loading.set(true);
    this.api.getProducts().subscribe({
      next: (prods) => {
        this.products.set(prods);
        this.loading.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('TechPackCreator: error loading products:', err);
        this.loading.set(false);
        this.cdr.detectChanges();
      }
    });

    this.dropdownService.getOptions().subscribe({
      next: (opts) => {
        const filterVals = (cat: string) => opts.filter(o => o.category === cat).map(o => o.value);
        this.backings.set(filterVals('backing'));
        this.bladders.set(filterVals('bladder'));
        this.coverMaterials.set(filterVals('coverMaterial'));
        this.bondings.set(filterVals('bonding'));
        this.pricepoints.set(filterVals('pricepoint'));
        this.cdr.detectChanges();
      },
      error: (err) => console.error('TechPackCreator: error loading dropdown options:', err)
    });
  }

  onProductSelect(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    if (!val) {
      this.selectedProductId = null;
      return;
    }
    const id = +val;
    this.selectedProductId = id;
    const prod = this.products().find((p) => p.id === id);
    if (prod) {
      this.loadProductData(prod);
    }
  }

  loadProductData(prod: Product): void {
    this.productHeader = {
      name: prod.name || '',
      articleNumber: prod.articleNumber || '',
      collection: prod.collection || '',
      year: prod.year || new Date().getFullYear(),
      category: prod.category || 'football',
      pricepoint: prod.pricepoint || '',
      supplierName: prod.supplier?.name || '',
      imagePath: prod.imagePath || '',
      imageName: prod.imageName || '',
    };

    // Deserialize construction
    const constr = prod.construction || {};
    const coverMat = String(constr['Cover Material'] || '');
    const bondingVal = String(constr['Bonding'] || '');
    const bladderVal = String(constr['Bladder'] || '');
    const panelsVal = constr['Cutting Die / Panels'];

    this.ballConstruction = {
      backing: String(constr['Backing'] || ''),
      bladder: bladderVal,
      coverMaterial: coverMat,
      cuttingDiePanels: panelsVal !== undefined && panelsVal !== null ? Number(panelsVal) : null,
      numberOfColors: constr['Number of Colors'] !== undefined && constr['Number of Colors'] !== null ? Number(constr['Number of Colors']) : null,
      bonding: bondingVal,
      debossing: constr['Debossing'] === 'Yes' || String(constr['Debossing']) === 'true',
      finishes: constr['Finishes'] === 'Yes' || String(constr['Finishes']) === 'true',
      carcass: String(constr['Carcass'] || ''),

      casingMaterialTier: coverMat || String(constr['Casing Material'] || ''),
      casingFinish: constr['Finishes'] !== undefined && constr['Finishes'] !== null ? String(constr['Finishes']) : String(constr['Finish'] || ''),
      casingThickness: String(constr['Casing Thickness'] || constr['Thickness'] || ''),
      panelCountShape: panelsVal !== undefined && panelsVal !== null ? String(panelsVal) : String(constr['Panel Count and Shape'] || constr['Panels'] || ''),
      constructionMethod: bondingVal || String(constr['Construction Method'] || ''),
      liningLayers: String(constr['Lining Layers'] || constr['Lining'] || ''),
      bladderMaterialType: bladderVal || String(constr['Bladder Material'] || ''),
      valveType: String(constr['Valve Type'] || constr['Valve'] || ''),

      circumference: String(constr['Circumference'] || ''),
      physicalWeight: String(constr['Weight'] || ''),
      pressure: String(constr['Pressure'] || ''),
      rebound: String(constr['Rebound'] || ''),
      waterAbsorption: String(constr['Water absorption'] || constr['Water Absorption'] || ''),
      shapeSizeRetention: String(constr['Shape/size retention'] || constr['Shape/Size Retention'] || ''),
    };

    const g = (typeof constr['GraphicPoints'] === 'object' && constr['GraphicPoints'] !== null ? constr['GraphicPoints'] : {}) as Record<string, any>;
    this.graphicPoints = {
      colorCallouts: { title: '1. Color Callouts (Pantone Codes)', path: g['colorCallouts']?.path || '', name: g['colorCallouts']?.name || '', notes: g['colorCallouts']?.notes || String(constr['Color Callouts (Pantone)'] || '') },
      logoPlacement: { title: '2. Logo Placement & Position', path: g['logoPlacement']?.path || '', name: g['logoPlacement']?.name || '', notes: g['logoPlacement']?.notes || String(constr['Logo Placement'] || '') },
      printMethod: { title: '3. Print Method', path: g['printMethod']?.path || '', name: g['printMethod']?.name || '', notes: g['printMethod']?.notes || String(constr['Print Method'] || '') },
      printColors: { title: '4. Print Colors (CMYK + Pantone)', path: g['printColors']?.path || '', name: g['printColors']?.name || '', notes: g['printColors']?.notes || String(constr['Print Colors (Pantone/CMYK)'] || '') },
      logoVector: { title: '5. Logo Vector File', path: g['logoVector']?.path || prod.graphicLogoPath || '', name: g['logoVector']?.name || prod.graphicLogoName || '', notes: g['logoVector']?.notes || '' },
      labelBadge: { title: '6. Label / Badge (Quality Mark)', path: g['labelBadge']?.path || '', name: g['labelBadge']?.name || '', notes: g['labelBadge']?.notes || String(constr['Label/Badge'] || '') },
      ballColor: { title: '7. Ball Color (Background Panel)', path: g['ballColor']?.path || '', name: g['ballColor']?.name || '', notes: g['ballColor']?.notes || String(constr['Ball Color'] || '') },
      patternLayout: { title: '8. Pattern & Flat Panel Net Layout', path: g['patternLayout']?.path || prod.graphicPatternPath || '', name: g['patternLayout']?.name || prod.graphicPatternName || '', notes: g['patternLayout']?.notes || String(constr['Pattern Details'] || '') },
    };

    const p = (typeof constr['PackagingSpecs'] === 'object' && constr['PackagingSpecs'] !== null ? constr['PackagingSpecs'] : {}) as Record<string, any>;
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

    const q = (typeof constr['QualitySpecs'] === 'object' && constr['QualitySpecs'] !== null ? constr['QualitySpecs'] : {}) as Record<string, any>;
    this.qualitySpecs = {
      preProductionSamples: String(q['preProductionSamples'] || ''),
      aqlInspectionLevel: String(q['aqlInspectionLevel'] || ''),
      rejectionCriteria: String(q['rejectionCriteria'] || ''),
      referenceStandard: String(q['referenceStandard'] || ''),
      thirdPartyTestingLab: String(q['thirdPartyTestingLab'] || ''),
    };

    this.cdr.detectChanges();
  }

  getPublicUrl(path: string): string {
    return this.api.getPublicImageUrl(path);
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

  get graphicPointsList() {
    return Object.values(this.graphicPoints);
  }

  hasAnyGraphicImage(): boolean {
    return Object.values(this.graphicPoints).some(pt => !!pt.path);
  }

  hasCasingSpecs(): boolean {
    const b = this.ballConstruction;
    return !!(b.casingMaterialTier || b.casingFinish || b.casingThickness || b.panelCountShape || b.constructionMethod);
  }

  hasBladderSpecs(): boolean {
    const b = this.ballConstruction;
    return !!(b.bladderMaterialType || b.valveType);
  }

  hasPhysicalSpecs(): boolean {
    const b = this.ballConstruction;
    return !!(b.circumference || b.physicalWeight || b.pressure || b.rebound || b.waterAbsorption || b.shapeSizeRetention);
  }

  hasPackagingSpecs(): boolean {
    const p = this.packagingSpecs;
    return !!(p.individualPackaging || p.inflationState || p.boxDimensions || p.unitsPerCarton !== null || (p.koraBrandingOnBox && p.koraBrandingArtwork.path) || p.barcodeEan || p.barcodeEanFile.path);
  }

  hasQualitySpecs(): boolean {
    const q = this.qualitySpecs;
    return !!(q.preProductionSamples || q.aqlInspectionLevel || q.referenceStandard || q.thirdPartyTestingLab || q.rejectionCriteria);
  }

  exportPdf(): void {
    window.print();
  }
}
