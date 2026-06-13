import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ProductsStore } from '../../store/products.store';
import { SuppliersStore } from '../../store/suppliers.store';
import { ProductCategory } from '../../core/models/product.model';

@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe],
  template: `
    <div class="p-8">

      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold text-white">Product Catalog</h1>
          <p class="text-zinc-400 text-sm mt-1">{{ store.totalProducts() }} products across all suppliers</p>
        </div>
        <a
          routerLink="/products/new"
          class="px-4 py-2 bg-white text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-100 transition-colors"
        >
          + Add Product
        </a>
      </div>

      <!-- Filters -->
      <div class="flex gap-3 mb-6">
        <select
          [(ngModel)]="selectedSupplier"
          (ngModelChange)="applyFilter()"
          class="bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-500"
        >
          <option [ngValue]="null">All Suppliers</option>
          @for (s of suppliersStore.suppliers(); track s.id) {
            <option [ngValue]="s.id">{{ s.name }}</option>
          }
        </select>

        <select
          [(ngModel)]="selectedCategory"
          (ngModelChange)="applyFilter()"
          class="bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-500"
        >
          <option [ngValue]="null">All Categories</option>
          <option value="football">Football</option>
          <option value="handball">Handball</option>
          <option value="lifestyle">Lifestyle</option>
        </select>
      </div>

      <!-- Loading -->
      @if (store.loading()) {
        <div class="flex items-center justify-center py-20">
          <div class="w-6 h-6 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
        </div>
      }

      <!-- Error -->
      @if (store.error()) {
        <div class="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
          {{ store.error() }}
        </div>
      }

      <!-- Empty state -->
      @if (!store.loading() && store.products().length === 0) {
        <div class="text-center py-20">
          <p class="text-4xl mb-4">⚽</p>
          <p class="text-zinc-400 text-sm">No products yet.</p>
          <a routerLink="/products/new" class="text-white text-sm underline mt-2 inline-block">Add your first product</a>
        </div>
      }

      <!-- Table -->
      @if (!store.loading() && store.filteredProducts().length > 0) {
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-zinc-800">
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Article #</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Name</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Category</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Supplier</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Unit Price</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">MOQ</th>
                <th class="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              @for (product of store.filteredProducts(); track product.id) {
                <tr class="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td class="px-6 py-4 text-zinc-400 font-mono text-xs">{{ product.articleNumber }}</td>
                  <td class="px-6 py-4 font-medium text-white">{{ product.name }}</td>
                  <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded-md text-xs font-medium"
                      [class]="categoryClass(product.category)">
                      {{ product.category ?? '—' }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-zinc-400">{{ product.supplier?.name ?? '—' }}</td>
                  <td class="px-6 py-4 text-white font-medium">
                    {{ product.unitPrice | number:'1.2-2' }} {{ product.currency }}
                  </td>
                  <td class="px-6 py-4 text-zinc-400">{{ product.moq ?? '—' }}</td>
                  <td class="px-6 py-4 text-right">
                    <a
                      [routerLink]="['/products', product.id, 'edit']"
                      class="text-zinc-400 hover:text-white text-xs underline mr-4"
                    >Edit</a>
                    <button
                      (click)="delete(product.id)"
                      class="text-red-400 hover:text-red-300 text-xs"
                    >Delete</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class ProductsListComponent implements OnInit {
  readonly store = inject(ProductsStore);
  readonly suppliersStore = inject(SuppliersStore);

  selectedSupplier: number | null = null;
  selectedCategory: ProductCategory | null = null;

  ngOnInit(): void {
    this.store.loadProducts({});
    this.suppliersStore.loadSuppliers();
  }

  applyFilter(): void {
    this.store.loadProducts({
      supplierId: this.selectedSupplier ?? undefined,
      category: this.selectedCategory ?? undefined,
    });
  }

  delete(id: number): void {
    if (confirm('Delete this product?')) {
      this.store.deleteProduct(id);
    }
  }

  categoryClass(category?: string): string {
    switch (category) {
      case 'football': return 'bg-green-900/40 text-green-400';
      case 'handball': return 'bg-blue-900/40 text-blue-400';
      case 'lifestyle': return 'bg-purple-900/40 text-purple-400';
      default: return 'bg-zinc-800 text-zinc-400';
    }
  }
}
