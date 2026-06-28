import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { B2BAccount } from '../../core/models/account.model';
import { Product } from '../../core/models/product.model';
import { LucideAngularModule } from 'lucide-angular';

export interface ForecastDisplayItem {
  productId: number;
  productName: string;
  articleNumber: string;
  category: string;
  imagePath?: string;
  quantity: number;
  orderedQuantity: number;
  remainingQuantity: number;
}

export interface AccountForecastGroup {
  accountId: number;
  companyName: string;
  accountCode: string;
  forecastId: string;
  year: number;
  status: string;
  totalForecastUnits: number;
  totalOrderedUnits: number;
  totalRemainingUnits: number;
  items: ForecastDisplayItem[];
}

@Component({
  selector: 'app-forecasts-list',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './forecasts-list.component.html',
})
export class ForecastsListComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly authService = inject(AuthService);

  readonly loading = signal<boolean>(true);
  readonly forecastGroups = signal<AccountForecastGroup[]>([]);
  readonly expandedGroupIds = signal<Set<string>>(new Set());
  readonly searchQuery = signal<string>('');

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.api.getAccounts().subscribe({
      next: (accounts) => {
        this.api.getProducts().subscribe({
          next: (products) => {
            this.processForecasts(accounts, products);
            this.loading.set(false);
          },
          error: (err) => {
            console.error('Failed to load products for forecasts:', err);
            this.loading.set(false);
          },
        });
      },
      error: (err) => {
        console.error('Failed to load accounts for forecasts:', err);
        this.loading.set(false);
      },
    });
  }

  private processForecasts(accounts: B2BAccount[], products: Product[]): void {
    const productMap = new Map<number, Product>();
    products.forEach((p) => productMap.set(p.id, p));

    const currentUser = this.authService.currentUser();
    const isSupplier = currentUser?.role === 'supplier';
    const supplierId = currentUser?.supplierId;

    const groups: AccountForecastGroup[] = [];

    accounts.forEach((acc) => {
      if (!acc.forecasts || !Array.isArray(acc.forecasts)) return;

      acc.forecasts.forEach((fc) => {
        if (!fc.items || !Array.isArray(fc.items)) return;

        const displayItems: ForecastDisplayItem[] = [];
        let totalFc = 0;
        let totalOrd = 0;

        fc.items.forEach((item) => {
          const prod = productMap.get(item.productId);
          
          // If logged in as supplier, only show products for this supplier
          if (isSupplier && supplierId && prod && prod.supplierId !== supplierId) {
            return;
          }

          const q = item.quantity || 0;
          const ord = item.orderedQuantity || 0;
          const rem = Math.max(0, q - ord);

          totalFc += q;
          totalOrd += ord;

          displayItems.push({
            productId: item.productId,
            productName: prod ? prod.name : `Product #${item.productId}`,
            articleNumber: prod ? prod.articleNumber : '—',
            category: prod ? (prod.category || '—') : '—',
            imagePath: prod ? (prod.images?.[0]?.path || prod.imagePath || undefined) : undefined,
            quantity: q,
            orderedQuantity: ord,
            remainingQuantity: rem,
          });
        });

        if (displayItems.length > 0) {
          const groupKey = `${acc.id}-${fc.id || fc.year}`;
          groups.push({
            accountId: acc.id,
            companyName: acc.companyName,
            accountCode: acc.accountNumber || `ACC-${acc.id}`,
            forecastId: String(fc.id || fc.year),
            year: fc.year,
            status: fc.status || 'draft',
            totalForecastUnits: totalFc,
            totalOrderedUnits: totalOrd,
            totalRemainingUnits: Math.max(0, totalFc - totalOrd),
            items: displayItems,
          });
        }
      });
    });

    this.forecastGroups.set(groups);
    
    // Auto-expand all by default if 3 or fewer groups
    if (groups.length <= 3) {
      const allKeys = new Set(groups.map((g) => `${g.accountId}-${g.forecastId}`));
      this.expandedGroupIds.set(allKeys);
    }
  }

  toggleGroup(groupId: string): void {
    const current = new Set(this.expandedGroupIds());
    if (current.has(groupId)) {
      current.delete(groupId);
    } else {
      current.add(groupId);
    }
    this.expandedGroupIds.set(current);
  }

  isExpanded(groupId: string): boolean {
    return this.expandedGroupIds().has(groupId);
  }

  getPublicUrl(path?: string): string {
    if (!path) return '';
    return this.api.getPublicImageUrl(path);
  }

  filteredGroups = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.forecastGroups();
    return this.forecastGroups().filter((g) => {
      return (
        g.companyName.toLowerCase().includes(q) ||
        g.accountCode.toLowerCase().includes(q) ||
        String(g.year).includes(q) ||
        g.items.some((i) => i.productName.toLowerCase().includes(q) || i.articleNumber.toLowerCase().includes(q))
      );
    });
  });
}
