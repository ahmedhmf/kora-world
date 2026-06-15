import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SamplesStore } from '../../store/samples.store';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-samples-list',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="p-8">

      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold text-white">Supplier Samples</h1>
          <p class="text-zinc-400 text-sm mt-1">{{ store.totalSamples() }} samples requested or received</p>
        </div>
        <a
          routerLink="/samples/new"
          class="px-4 py-2 bg-white text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-100 transition-colors"
        >
          + Add Sample
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
      @if (!store.loading() && store.samples().length === 0) {
        <div class="text-center py-20">
          <p class="text-4xl mb-4">🧪</p>
          <p class="text-zinc-400 text-sm">No samples tracked yet.</p>
          <a routerLink="/samples/new" class="text-white text-sm underline mt-2 inline-block">Track your first sample</a>
        </div>
      }

      <!-- Table -->
      @if (!store.loading() && store.samples().length > 0) {
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-zinc-800">
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Article #</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Name & Spec</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Supplier</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Category</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Status</th>
                <th class="text-left px-6 py-4 text-zinc-400 font-medium">Comments</th>
                <th class="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              @for (sample of store.samples(); track sample.id) {
                <tr class="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td class="px-6 py-4 text-zinc-400 font-mono text-xs">{{ sample.articleNumber || '—' }}</td>
                  <td class="px-6 py-4 font-medium text-white">
                    <div class="flex items-center space-x-1.5 flex-wrap">
                      <a [routerLink]="['/samples', sample.id]" class="hover:underline hover:text-zinc-300 font-semibold cursor-pointer">{{ sample.name }}</a>
                      @if (sample.roundNumber && sample.roundNumber > 1) {
                        <span class="text-[10px] font-semibold bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700">
                          Round {{ sample.roundNumber }}
                        </span>
                      }
                    </div>
                    @if (sample.parentSampleId) {
                      <div class="text-[10px] text-zinc-500 mt-1 select-none">
                        ← Prev: <a [routerLink]="['/samples', sample.parentSampleId]" class="text-zinc-400 hover:text-zinc-300 underline">{{ sample.parentSample?.name || 'Round ' + ((sample.roundNumber || 1) - 1) }}</a>
                      </div>
                    }
                    @if (sample.construction && Object.keys(sample.construction).length > 0) {
                      <div class="flex flex-wrap gap-1.5 mt-1.5">
                        @for (entry of Object.entries(sample.construction); track entry[0]) {
                          <span class="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700/50">
                            {{ entry[0] }}: {{ entry[1] }}
                          </span>
                        }
                      </div>
                    }
                    @if (sample.techPackPath) {
                      <div
                        (click)="downloadTechPack(sample.techPackPath, sample.techPackName || '')"
                        class="mt-2 flex items-center space-x-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer select-none"
                      >
                        <svg class="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span class="underline truncate max-w-[180px]">{{ sample.techPackName || 'Download Tech Pack' }}</span>
                      </div>
                    }
                  </td>
                  <td class="px-6 py-4 text-zinc-400">{{ sample.supplier?.name ?? '—' }}</td>
                  <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded-md text-xs font-medium"
                      [class]="categoryClass(sample.category)">
                      {{ sample.category ?? '—' }}
                    </span>
                  </td>
                  <td class="px-6 py-4">
                    <span class="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
                      [class]="statusClass(sample.status)">
                      {{ sample.status }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-zinc-400 max-w-xs truncate" [title]="sample.comments ?? ''">
                    {{ sample.comments || '—' }}
                  </td>
                  <td class="px-6 py-4 text-right">
                    @if (sample.status === 'rejected') {
                      <a
                        [routerLink]="['/samples/new']"
                        [queryParams]="{ fromParentSampleId: sample.id }"
                        class="text-amber-400 hover:text-amber-300 text-xs font-semibold mr-4 inline-flex items-center"
                        title="Request next round of sample"
                      >
                        <svg class="h-3.5 w-3.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 6.5" />
                        </svg>
                        <span>Next Round</span>
                      </a>
                    }
                    @if (sample.status === 'approved') {
                      <a
                        [routerLink]="['/products/new']"
                        [queryParams]="{ fromSampleId: sample.id }"
                        class="text-emerald-400 hover:text-emerald-300 text-xs font-semibold mr-4 inline-flex items-center"
                        title="Promote approved sample to Product"
                      >
                        <svg class="h-3.5 w-3.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z" />
                        </svg>
                        <span>Promote</span>
                      </a>
                    }
                    <a
                      [routerLink]="['/samples', sample.id]"
                      class="text-zinc-400 hover:text-white text-xs underline mr-4"
                    >View</a>
                    <a
                      [routerLink]="['/samples', sample.id, 'edit']"
                      class="text-zinc-400 hover:text-white text-xs underline mr-4"
                    >Edit</a>
                    <button
                      (click)="delete(sample.id)"
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
export class SamplesListComponent implements OnInit {
  readonly store = inject(SamplesStore);
  private readonly api = inject(ApiService);
  readonly Object = Object;

  ngOnInit(): void {
    this.store.loadSamples();
  }

  delete(id: number): void {
    if (confirm('Delete this sample record?')) {
      this.store.deleteSample(id);
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
