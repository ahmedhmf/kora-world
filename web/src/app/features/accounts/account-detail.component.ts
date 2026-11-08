import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AccountsStore } from '../../store/accounts.store';
import { PurchaseOrdersStore } from '../../store/purchase-orders.store';
import { B2BAccount, AccountStatus } from '../../core/models/account.model';
import { DialogService } from '../../core/services/dialog.service';
import { AuthService } from '../../core/services/auth.service';

import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Product } from '../../core/models/product.model';

@Component({
  selector: 'app-account-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, LucideAngularModule],
  templateUrl: './account-detail.component.html',
})
export class AccountDetailComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly store = inject(AccountsStore);
  readonly poStore = inject(PurchaseOrdersStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  readonly authService = inject(AuthService);

  account = signal<B2BAccount | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  activeTab = signal<'details' | 'forecasts' | 'inventory'>('details');
  inventory = signal<Array<{
    productId: number; articleNumber: string; productName: string; quantity: number;
    deliveries: Array<{ noteId: number; noteNumber: string; deliveryDate: string; quantity: number }>;
  }>>([]);
  inventoryError = signal('');
  salesReports = signal<any[]>([]);
  salesError = signal('');
  salesSuccess = signal('');
  salesBusy = signal(false);
  salesFile: File | null = null;
  salesYear = this.currentIsoYear();

  private currentIsoYear(): number {
    const date = new Date();
    const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
    return utc.getUTCFullYear();
  }
  salesWeek = this.currentIsoWeek();

  private currentIsoWeek(): number {
    const now = new Date();
    const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  private isoWeekDates(year: number, week: number): { weekStart: string; weekEnd: string } | null {
    if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(week) || week < 1 || week > 53) return null;
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - (jan4.getUTCDay() || 7) + 1 + (week - 1) * 7);
    const thursday = new Date(monday);
    thursday.setUTCDate(monday.getUTCDate() + 3);
    if (thursday.getUTCFullYear() !== year) return null;
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return { weekStart: monday.toISOString().slice(0, 10), weekEnd: sunday.toISOString().slice(0, 10) };
  }
  salesRemarks = '';
  salesItems: Array<{ productId: number; quantity: number }> = [{ productId: 0, quantity: 1 }];

  selectSalesPdf(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.salesFile = file && file.type === 'application/pdf' && file.size <= 15 * 1024 * 1024 ? file : null;
    if (file && !this.salesFile) this.salesError.set('Choose a PDF under 15 MB');
    else this.salesError.set('');
  }

  addSalesItem(): void { this.salesItems.push({ productId: 0, quantity: 1 }); }
  removeSalesItem(index: number): void { this.salesItems.splice(index, 1); }

  saveSalesDraft(): void {
    const acct = this.account();
    const period = this.isoWeekDates(Number(this.salesYear), Number(this.salesWeek));
    if (!acct || !this.salesFile || !period || !this.salesItems.length ||
      this.salesItems.some(i => !i.productId || !Number.isInteger(Number(i.quantity)) || Number(i.quantity) < 1) ||
      new Set(this.salesItems.map(i => i.productId)).size !== this.salesItems.length) {
      this.salesError.set('Provide a PDF, valid ISO work week and year, and unique products with positive quantities.');
      return;
    }
    this.salesBusy.set(true); this.salesError.set(''); this.salesSuccess.set('');
    this.api.uploadFile(this.salesFile).subscribe({
      next: uploaded => this.api.createWeeklySalesReport(acct.id, {
        weekStart: period!.weekStart, weekEnd: period!.weekEnd,
        filePath: uploaded.path, fileName: uploaded.name, remarks: this.salesRemarks,
        items: this.salesItems.map(i => ({ productId: Number(i.productId), quantity: Number(i.quantity) })),
      }).subscribe({
        next: () => {
          this.salesBusy.set(false);
          this.salesFile = null; this.salesRemarks = ''; this.salesItems = [{ productId: 0, quantity: 1 }];
          this.salesSuccess.set('Draft saved. Review and approve it to deduct inventory.');
          this.loadInventory();
        },
        error: err => { this.salesBusy.set(false); this.salesError.set(err.error?.message || 'Could not save sales report'); },
      }),
      error: () => { this.salesBusy.set(false); this.salesError.set('PDF upload failed'); },
    });
  }

  async approveSalesReport(report: any): Promise<void> {
    if (this.salesBusy()) return;
    const ok = await this.dialogService.confirm('Approve weekly sales',
      'Approve this report and deduct its sold quantities from customer inventory? This action cannot be undone.');
    if (!ok) return;
    this.salesBusy.set(true); this.salesError.set(''); this.salesSuccess.set('');
    this.api.approveWeeklySalesReport(report.id).subscribe({
      next: () => { this.salesBusy.set(false); this.salesSuccess.set('Report approved and inventory updated.'); this.loadInventory(); },
      error: err => { this.salesBusy.set(false); this.salesError.set(err.error?.message || 'Could not approve report'); },
    });
  }

  viewSalesPdf(report: any): void {
    this.api.downloadFile(report.filePath).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      },
      error: () => this.salesError.set('Could not open report PDF'),
    });
  }
  loadInventory(): void {
    const acct = this.account();
    if (!acct) return;
    this.inventoryError.set('');
    this.api.getWeeklySalesReports(acct.id).subscribe({
      next: reports => this.salesReports.set(reports),
      error: () => this.salesError.set('Could not load weekly sales reports'),
    });
    this.api.getAccountInventory(acct.id).subscribe({
      next: rows => this.inventory.set(rows),
      error: () => this.inventoryError.set('Could not load customer inventory'),
    });
  }
  showInventory(): void {
    this.activeTab.set('inventory');
    this.loadInventory();
  }

  // Forecast-related state
  isModalOpen = signal(false);
  forecastId = signal<string | null>(null);
  forecastYear = signal<number>(new Date().getFullYear());
  forecastItems = signal<Array<{ productId: number; quantity: number }>>([]);
  allProducts = signal<Product[]>([]);

  constructor() {
    // Automatically keep the local account signal in sync with store updates
    effect(() => {
      const selected = this.store.selectedAccount();
      if (selected) {
        this.account.set(selected);
      }
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.loading.set(true);
        this.api.getAccount(+id).subscribe({
          next: (acct) => {
            this.account.set(acct);
            this.store.selectAccount(acct);
            this.loading.set(false);
          },
          error: (err) => {
            this.error.set('Failed to load account details.');
            this.loading.set(false);
            console.error(err);
          }
        });
      }
    });

    this.api.getProducts().subscribe({
      next: (prods) => this.allProducts.set(prods),
      error: (err) => console.error('Failed to load products', err),
    });

    this.poStore.loadPurchaseOrders();
  }

  async confirmDelete(id: number): Promise<void> {
    const ok = await this.dialogService.confirm('Delete Account', 'Are you sure you want to delete this account? This action cannot be undone.');
    if (ok) {
      this.store.deleteAccount(id);
      this.router.navigate(['/accounts']);
    }
  }

  getStatusClass(status: AccountStatus): string {
    switch (status) {
      case 'active':           return 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60';
      case 'under_discussion': return 'bg-amber-950/40 text-amber-400 border-amber-800/60';
      case 'suspended':        return 'bg-red-950/40 text-red-400 border-red-800/60';
      case 'inactive':
      default:                 return 'bg-zinc-800/50 text-zinc-400 border-zinc-700/60';
    }
  }

  getStatusLabel(status: AccountStatus): string {
    const labels: Record<AccountStatus, string> = {
      active: 'Active', under_discussion: 'Under Discussion',
      suspended: 'Suspended', inactive: 'Inactive',
    };
    return labels[status] ?? status;
  }

  getAvatarBg(type: string): string {
    const map: Record<string, string> = {
      'Retailer':         'bg-gradient-to-br from-blue-600 to-indigo-700',
      'Distributor':      'bg-gradient-to-br from-violet-600 to-purple-700',
      'Sports Club':      'bg-gradient-to-br from-emerald-600 to-teal-700',
      'School / Academy': 'bg-gradient-to-br from-amber-600 to-orange-700',
      'Corporate':        'bg-gradient-to-br from-zinc-600 to-zinc-700',
      'Other':            'bg-gradient-to-br from-pink-600 to-rose-700',
    };
    return map[type] ?? 'bg-zinc-700';
  }

  // Forecast actions
  openAddForecastModal(): void {
    this.forecastId.set(null);
    this.forecastYear.set(new Date().getFullYear());
    this.forecastItems.set([{ productId: this.allProducts()[0]?.id || 0, quantity: 1 }]);
    this.isModalOpen.set(true);
  }

  openEditForecastModal(forecast: any): void {
    this.forecastId.set(forecast.id);
    this.forecastYear.set(forecast.year);
    this.forecastItems.set(forecast.items.map((it: any) => ({ ...it })));
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  addForecastItem(): void {
    const firstProd = this.allProducts()[0]?.id || 0;
    this.forecastItems.update((items) => [...items, { productId: firstProd, quantity: 1 }]);
  }

  removeForecastItem(index: number): void {
    this.forecastItems.update((items) => items.filter((_, i) => i !== index));
  }

  saveForecast(): void {
    const acct = this.account();
    if (!acct) return;

    const currentForecasts = acct.forecasts ? [...acct.forecasts] : [];
    const validItems = this.forecastItems().filter((item) => item.productId > 0 && item.quantity > 0);

    if (this.forecastId()) {
      // Edit mode
      const idx = currentForecasts.findIndex((f) => f.id === this.forecastId());
      if (idx !== -1) {
        currentForecasts[idx] = {
          ...currentForecasts[idx],
          year: this.forecastYear(),
          items: validItems,
        };
      }
    } else {
      // Add mode
      currentForecasts.push({
        id: Math.random().toString(36).substring(2, 9),
        year: this.forecastYear(),
        status: 'draft',
        items: validItems,
      });
    }

    this.store.updateForecasts({
      id: acct.id,
      forecasts: currentForecasts,
    });

    this.closeModal();
  }

  async deleteForecast(forecastId: string): Promise<void> {
    const acct = this.account();
    if (!acct) return;

    const ok = await this.dialogService.confirm('Delete Forecast', 'Are you sure you want to delete this forecast?');
    if (!ok) return;

    const currentForecasts = (acct.forecasts || []).filter((f) => f.id !== forecastId);
    this.store.updateForecasts({
      id: acct.id,
      forecasts: currentForecasts,
    });
  }

  // PO Generation with Selection modal state
  isPOModalOpen = signal(false);
  poForecastId = signal<string | null>(null);
  poItems = signal<Array<{ productId: number; quantity: number; selected: boolean }>>([]);

  openPOModal(forecast: any): void {
    this.poForecastId.set(forecast.id);
    this.poItems.set(forecast.items.map((it: any) => {
      const remaining = it.quantity - (it.orderedQuantity || 0);
      return {
        productId: it.productId,
        quantity: remaining > 0 ? remaining : 0,
        selected: remaining > 0
      };
    }));
    this.isPOModalOpen.set(true);
  }

  closePOModal(): void {
    this.isPOModalOpen.set(false);
  }

  generateSelectedPOs(): void {
    const acct = this.account();
    if (!acct || !this.poForecastId()) return;

    const selectedList = this.poItems()
      .filter((it) => it.selected && it.quantity > 0)
      .map((it) => ({ productId: it.productId, quantity: it.quantity }));

    if (selectedList.length === 0) {
      alert('Please select at least one item with quantity greater than 0.');
      return;
    }

    this.store.createPOsFromForecast({
      id: acct.id,
      forecastId: this.poForecastId()!,
      selectedItems: selectedList,
      onSuccess: () => {
        this.closePOModal();
      },
    });
  }

  getProductName(id: number): string {
    const prod = this.allProducts().find((p) => Number(p.id) === Number(id));
    return prod ? `${prod.name} (${prod.articleNumber})` : `Product #${id}`;
  }

  getPOsForForecast(companyName: string, year: number): any[] {
    const term = `Auto-generated from B2B Client Forecast (Year: ${year}) for Account: ${companyName}`;
    return this.poStore.purchaseOrders().filter((po) => po.notes && po.notes.includes(term));
  }
}
