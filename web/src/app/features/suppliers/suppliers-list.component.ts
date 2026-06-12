import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SuppliersStore } from '../../store/suppliers.store';

@Component({
  selector: 'app-suppliers-list',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="p-8">

      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold text-white">Suppliers</h1>
          <p class="text-zinc-400 text-sm mt-1">{{ store.totalSuppliers() }} suppliers in your network</p>
        </div>
        <a
          routerLink="/suppliers/new"
          class="px-4 py-2 bg-white text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-100 transition-colors"
        >
          + Add Supplier
        </a>
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
      @if (!store.loading() && store.suppliers().length === 0) {
        <div class="text-center py-20">
          <p class="text-4xl mb-4">🏭</p>
          <p class="text-zinc-400 text-sm">No suppliers yet.</p>
          <a routerLink="/suppliers/new" class="text-white text-sm underline mt-2 inline-block">Add your first supplier</a>
        </div>
      }

      <!-- Table -->
      @if (!store.loading() && store.suppliers().length > 0) {
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-zinc-800">
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Name</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Country</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Currency</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Lead Time</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Contact</th>
                <th class="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              @for (supplier of store.suppliers(); track supplier.id) {
                <tr class="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td class="px-6 py-4 font-medium text-white">{{ supplier.name }}</td>
                  <td class="px-6 py-4 text-zinc-400">{{ supplier.country ?? '—' }}</td>
                  <td class="px-6 py-4 text-zinc-400">{{ supplier.currency ?? '—' }}</td>
                  <td class="px-6 py-4 text-zinc-400">
                    {{ supplier.leadTimeDays ? supplier.leadTimeDays + ' days' : '—' }}
                  </td>
                  <td class="px-6 py-4 text-zinc-400">{{ supplier.contactEmail ?? '—' }}</td>
                  <td class="px-6 py-4 text-right">
                    <a
                      [routerLink]="['/suppliers', supplier.id, 'edit']"
                      class="text-zinc-400 hover:text-white text-xs underline mr-4"
                    >Edit</a>
                    <button
                      (click)="delete(supplier.id)"
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
export class SuppliersListComponent implements OnInit {
  readonly store = inject(SuppliersStore);

  ngOnInit(): void {
    this.store.loadSuppliers();
  }

  delete(id: number): void {
    if (confirm('Delete this supplier?')) {
      this.store.deleteSupplier(id);
    }
  }
}
