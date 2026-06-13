import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SuppliersStore } from '../../store/suppliers.store';
import { ProductsStore } from '../../store/products.store';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="p-8">
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-white">Dashboard</h1>
        <p class="text-zinc-400 text-sm mt-1">Welcome to Kora World</p>
      </div>

      <div class="grid grid-cols-3 gap-4 mb-8">
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p class="text-zinc-400 text-sm mb-1">Suppliers</p>
          <p class="text-3xl font-bold text-white">{{ suppliersStore.totalSuppliers() }}</p>
          <a routerLink="/suppliers" class="text-zinc-500 text-xs hover:text-zinc-300 mt-2 inline-block">View all →</a>
        </div>
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p class="text-zinc-400 text-sm mb-1">Products</p>
          <p class="text-3xl font-bold text-white">{{ productsStore.totalProducts() }}</p>
          <a routerLink="/products" class="text-zinc-500 text-xs hover:text-zinc-300 mt-2 inline-block">View all →</a>
        </div>
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p class="text-zinc-400 text-sm mb-1">Purchase Orders</p>
          <p class="text-3xl font-bold text-white">—</p>
          <a routerLink="/purchase-orders" class="text-zinc-500 text-xs hover:text-zinc-300 mt-2 inline-block">View all →</a>
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  readonly suppliersStore = inject(SuppliersStore);
  readonly productsStore = inject(ProductsStore);

  ngOnInit(): void {
    this.suppliersStore.loadSuppliers();
    this.productsStore.loadProducts({});
  }
}
