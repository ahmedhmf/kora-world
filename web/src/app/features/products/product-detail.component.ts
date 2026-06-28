import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { Product } from '../../core/models/product.model';
import { ProductsStore } from '../../store/products.store';
import { DialogService } from '../../core/services/dialog.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe],
  templateUrl: './product-detail.component.html',
})
export class ProductDetailComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productsStore = inject(ProductsStore);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogService = inject(DialogService);

  product = signal<Product | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  selectedImageIndex = signal(0);

  readonly Object = Object;

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.loadProductDetails(+id);
      } else {
        this.error.set('Product ID not specified.');
        this.loading.set(false);
      }
    });
  }

  private loadProductDetails(id: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.getProduct(id).subscribe({
      next: (product) => {
        this.product.set(product);
        this.loading.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading product detail:', err);
        this.error.set('Could not load product details. It may not exist.');
        this.loading.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  async deleteProduct(id: number): Promise<void> {
    const ok = await this.dialogService.confirm('Delete Product', 'Delete this product permanently?');
    if (ok) {
      this.productsStore.deleteProduct(id);
      this.router.navigate(['/products']);
    }
  }

  downloadTechPack(path: string, originalName: string): void {
    this.api.downloadFile(path).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = originalName || 'tech-pack';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.dialogService.alert('Download Failed', 'Could not download file. You may not have access permission.');
        console.error('Download error:', err);
      }
    });
  }

  categoryClass(category?: string): string {
    switch (category) {
      case 'football': return 'bg-green-900/40 text-green-400';
      case 'handball': return 'bg-blue-900/40 text-blue-400';
      case 'lifestyle': return 'bg-purple-900/40 text-purple-400';
      default: return 'bg-zinc-800 text-zinc-400';
    }
  }

  getCategoryPlaceholder(category?: string): string {
    switch (category) {
      case 'football': return '⚽';
      case 'handball': return '🤾';
      case 'lifestyle': return '👟';
      default: return '📦';
    }
  }

  getPublicUrl(path: string): string {
    return this.api.getPublicImageUrl(path);
  }

  getImages(p: Product): { path: string; name: string }[] {
    if (p.images && Array.isArray(p.images) && p.images.length > 0) {
      return p.images;
    }
    if (p.imagePath) {
      return [{ path: p.imagePath, name: p.imageName || 'Product Photo' }];
    }
    return [];
  }

  selectImage(idx: number): void {
    this.selectedImageIndex.set(idx);
    this.cdr.detectChanges();
  }

  getBarcodeSpecs(p: Product): { barcodeEan?: string; barcodeEanFile?: { path?: string; name?: string } } | null {
    if (!p.construction) return null;
    const pkg = p.construction['PackagingSpecs'] as any;
    if (!pkg) return null;
    if (pkg.barcodeEan || (pkg.barcodeEanFile && pkg.barcodeEanFile.path)) {
      return pkg;
    }
    return null;
  }

  getOrderedTechSpecs(p: Product): { label: string; value: string }[] {
    const constr = p.construction;
    if (!constr) return [];
    
    const fields = [
      { key: 'Cover Material', label: 'Cover Material' },
      { key: 'Backing', label: 'Backing' },
      { key: 'Bladder', label: 'Bladder' },
      { key: 'Carcass', label: 'Carcass' },
      { key: 'Bonding', label: 'Bonding' },
      { key: 'Number of Colors', label: 'Number of Colors' },
      { key: 'Cutting Die / Panels', label: 'Cutting Die / Panels' },
      { key: 'Finishes', label: 'Finishes' },
      { key: 'Debossing', label: 'Debossing' },
    ];

    const result: { label: string; value: string }[] = [];
    for (const f of fields) {
      if (constr[f.key] !== undefined && constr[f.key] !== null && constr[f.key] !== '') {
        result.push({ label: f.label, value: String(constr[f.key]) });
      }
    }
    return result;
  }

  getPhysicalSpecs(p: Product): { label: string; value: string }[] {
    const constr = p.construction;
    if (!constr) return [];
    
    const fields = [
      { key: 'Circumference', label: 'Circumference' },
      { key: 'Weight', label: 'Weight' },
      { key: 'Pressure', label: 'Pressure' },
      { key: 'Rebound', label: 'Rebound' },
      { key: 'Water absorption', label: 'Water Absorption' },
      { key: 'Shape/size retention', label: 'Shape / Size Retention' },
    ];

    const result: { label: string; value: string }[] = [];
    for (const f of fields) {
      if (constr[f.key] !== undefined && constr[f.key] !== null && constr[f.key] !== '') {
        result.push({ label: f.label, value: String(constr[f.key]) });
      }
    }
    return result;
  }
}
