import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PrototypesStore } from '../../store/prototypes.store';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-prototypes-list',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="p-8">

      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold text-white">Supplier Prototypes</h1>
          <p class="text-zinc-400 text-sm mt-1">{{ store.totalPrototypes() }} prototypes requested or received</p>
        </div>
        <a
          routerLink="/prototypes/new"
          class="px-4 py-2 bg-white text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-100 transition-colors"
        >
          + Add Prototype
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
      @if (!store.loading() && store.prototypes().length === 0) {
        <div class="text-center py-20">
          <p class="text-4xl mb-4">🧪</p>
          <p class="text-zinc-400 text-sm">No prototypes tracked yet.</p>
          <a routerLink="/prototypes/new" class="text-white text-sm underline mt-2 inline-block">Track your first prototype</a>
        </div>
      }

      <!-- Table -->
      @if (!store.loading() && store.prototypes().length > 0) {
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-zinc-800">
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Name & Spec</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Supplier</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Category</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Status</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Comments</th>
                <th class="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              @for (prototype of store.prototypes(); track prototype.id) {
                <tr class="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td class="px-6 py-4 font-medium text-white">
                    <div>{{ prototype.name }}</div>
                    @if (prototype.construction && Object.keys(prototype.construction).length > 0) {
                      <div class="flex flex-wrap gap-1.5 mt-1.5">
                        @for (entry of Object.entries(prototype.construction); track entry[0]) {
                          <span class="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700/50">
                            {{ entry[0] }}: {{ entry[1] }}
                          </span>
                        }
                      </div>
                    }
                    @if (prototype.techPackPath) {
                      <div
                        (click)="downloadTechPack(prototype.techPackPath, prototype.techPackName || '')"
                        class="mt-2 flex items-center space-x-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer select-none"
                      >
                        <svg class="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span class="underline truncate max-w-[180px]">{{ prototype.techPackName || 'Download Tech Pack' }}</span>
                      </div>
                    }
                  </td>
                  <td class="px-6 py-4 text-zinc-400">{{ prototype.supplier?.name ?? '—' }}</td>
                  <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded-md text-xs font-medium"
                      [class]="categoryClass(prototype.category)">
                      {{ prototype.category ?? '—' }}
                    </span>
                  </td>
                  <td class="px-6 py-4">
                    <span class="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
                      [class]="statusClass(prototype.status)">
                      {{ prototype.status }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-zinc-400 max-w-xs truncate" [title]="prototype.comments ?? ''">
                    {{ prototype.comments || '—' }}
                  </td>
                  <td class="px-6 py-4 text-right">
                    @if (prototype.status === 'approved') {
                      <a
                        [routerLink]="['/products/new']"
                        [queryParams]="{ fromPrototypeId: prototype.id }"
                        class="text-emerald-400 hover:text-emerald-300 text-xs font-semibold mr-4 inline-flex items-center"
                        title="Promote approved prototype to Product"
                      >
                        <svg class="h-3.5 w-3.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z" />
                        </svg>
                        <span>Promote</span>
                      </a>
                    }
                    <a
                      [routerLink]="['/prototypes', prototype.id, 'edit']"
                      class="text-zinc-400 hover:text-white text-xs underline mr-4"
                    >Edit</a>
                    <button
                      (click)="delete(prototype.id)"
                      class="text-red-400 hover:text-red-300 text-xs font-medium"
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
export class PrototypesListComponent implements OnInit {
  readonly store = inject(PrototypesStore);
  private readonly api = inject(ApiService);
  readonly Object = Object;

  ngOnInit(): void {
    this.store.loadPrototypes();
  }

  delete(id: number): void {
    if (confirm('Delete this prototype record?')) {
      this.store.deletePrototype(id);
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
        alert('Could not download file. You may not have access permission.');
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

  statusClass(status: string): string {
    switch (status) {
      case 'requested': return 'bg-zinc-800 text-zinc-400';
      case 'shipped': return 'bg-amber-900/40 text-amber-400 border border-amber-800/30';
      case 'received': return 'bg-blue-900/40 text-blue-400 border border-blue-800/30';
      case 'approved': return 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/30';
      case 'rejected': return 'bg-red-950/60 text-red-400 border border-red-900/30';
      default: return 'bg-zinc-800 text-zinc-400';
    }
  }
}
