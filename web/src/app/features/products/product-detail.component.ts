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
}
