import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductsStore } from '../../store/products.store';
import { SuppliersStore } from '../../store/suppliers.store';
import { ProductCategory } from '../../core/models/product.model';
import { ApiService } from '../../core/services/api.service';
import { DialogService } from '../../core/services/dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [RouterLink, FormsModule, LucideAngularModule],
  templateUrl: './products-list.component.html',
})
export class ProductsListComponent implements OnInit {
  readonly store = inject(ProductsStore);
  readonly suppliersStore = inject(SuppliersStore);
  readonly authService = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly dialogService = inject(DialogService);

  readonly Object = Object;

  selectedSupplier: number | null = null;
  selectedCategory: ProductCategory | null = null;
  targetCurrency: string = 'ORIGINAL';
  rates: Record<string, number> = {
    USD: 1.0,
    EGP: 48.0,
    EUR: 0.93,
    PKR: 278.0
  };
 
  ngOnInit(): void {
    const user = this.authService.currentUser();
    const supplierId = user?.role === 'supplier' ? user.supplierId : undefined;
    this.store.loadProducts({ supplierId });
    this.suppliersStore.loadSuppliers();
    this.fetchExchangeRates();
  }

  fetchExchangeRates(): void {
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(res => res.json())
      .then(data => {
        if (data && data.rates) {
          this.rates = data.rates;
        }
      })
      .catch(err => {
        console.error('Could not fetch live exchange rates, using defaults:', err);
      });
  }

  convertPrice(price: number | undefined | null, originalCurrency: string | undefined): { value: number | null, currency: string } {
    if (price === undefined || price === null) {
      return { value: null, currency: '' };
    }
    const orig = (originalCurrency || 'USD').toUpperCase();
    const target = this.targetCurrency;

    if (target === 'ORIGINAL') {
      return { value: price, currency: orig };
    }

    const rateOrig = this.rates[orig] || 1.0;
    const rateTarget = this.rates[target] || 1.0;

    // Convert to base (USD), then to target
    const priceInUSD = price / rateOrig;
    const convertedValue = priceInUSD * rateTarget;

    return { value: convertedValue, currency: target };
  }

  getFormattedPrice(price: number | undefined | null, originalCurrency: string | undefined): string {
    const res = this.convertPrice(price, originalCurrency);
    if (res.value === null) return '—';
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(res.value);
    return `${formatted} ${res.currency}`;
  }

  applyFilter(): void {
    const user = this.authService.currentUser();
    const supplierId = user?.role === 'supplier' ? user.supplierId : (this.selectedSupplier ?? undefined);
    this.store.loadProducts({
      supplierId,
      category: this.selectedCategory ?? undefined,
    });
  }

  async delete(id: number): Promise<void> {
    const ok = await this.dialogService.confirm('Delete Product', 'Are you sure you want to delete this product?');
    if (ok) {
      this.store.deleteProduct(id);
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
