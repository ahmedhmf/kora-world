import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { Sample } from '../../core/models/sample.model';
import { DialogService } from '../../core/services/dialog.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-sample-detail',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <div class="p-8 max-w-5xl">

      <!-- Navigation & Actions -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <a routerLink="/samples" class="text-zinc-500 hover:text-zinc-300 text-sm mb-2 inline-block">← Back to Samples</a>
          @if (sample(); as s) {
            <h1 class="text-3xl font-bold text-white flex items-center gap-3 flex-wrap">
              {{ s.name }}
              @if (s.articleNumber) {
                <span class="text-xs font-mono bg-zinc-800 text-zinc-400 border border-zinc-700 px-2.5 py-1 rounded">
                  {{ s.articleNumber }}
                </span>
              }
              <span class="text-xs uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full border" [class]="statusClass(s.status)">
                {{ s.status }}
              </span>
              @if (s.roundNumber && s.roundNumber > 1) {
                <span class="text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700 px-2.5 py-1 rounded">
                  Round {{ s.roundNumber }}
                </span>
              }
            </h1>
          }
        </div>

        @if (sample(); as s) {
          <div class="flex flex-wrap gap-3">
            @if (authService.currentUser()?.role !== 'supplier') {
              @if (s.status === 'rejected' && isLatestRound()) {
                <a
                  [routerLink]="['/samples/new']"
                  [queryParams]="{ fromParentSampleId: s.id }"
                  class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 6.5" />
                  </svg>
                  Request Next Round
                </a>
              }
              @if (s.status === 'approved') {
                <a
                  [routerLink]="['/products/new']"
                  [queryParams]="{ fromSampleId: s.id }"
                  class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z" />
                  </svg>
                  Promote to Product
                </a>
              }
            }
            <a
              [routerLink]="['/samples', s.id, 'receipt-protocol']"
              class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold rounded-lg border border-zinc-700 transition-colors flex items-center gap-1.5"
            >
              <svg class="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Receipt Protocol
              @if (s.receiptProtocol) {
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Protocol filled"></span>
              }
            </a>
            @if (authService.currentUser()?.role !== 'supplier') {
              <a
                [routerLink]="['/samples', s.id, 'edit']"
                class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold rounded-lg border border-zinc-700 transition-colors"
              >
                Edit Sample
              </a>
            }
          </div>
        }
      </div>

      @if (loading()) {
        <div class="flex items-center justify-center py-20">
          <div class="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
        </div>
      } @else if (error()) {
        <div class="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
          {{ error() }}
        </div>
      } @else if (sample(); as s) {
        
        <!-- Rounds Chain Timeline -->
        @if (rounds().length > 1) {
          <div class="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-6 mb-8">
            <h2 class="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-5">Rounds History</h2>
            <div class="relative flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-4">
              <!-- Timeline connector bar for large screens -->
              <div class="absolute left-4 top-0 bottom-0 w-0.5 md:left-0 md:right-0 md:top-1/2 md:bottom-auto md:h-0.5 bg-zinc-800 -z-10"></div>
              
              @for (r of rounds(); track r.id) {
                <div 
                  [routerLink]="['/samples', r.id]" 
                  class="flex items-start md:flex-col md:items-center text-left md:text-center group cursor-pointer relative z-10 flex-1"
                >
                  <!-- Timeline point marker -->
                  <div 
                    class="w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-all duration-300"
                    [class.border-white]="r.id === s.id"
                    [class.bg-white]="r.id === s.id"
                    [class.text-zinc-950]="r.id === s.id"
                    [class.border-zinc-700]="r.id !== s.id"
                    [class.bg-zinc-900]="r.id !== s.id"
                    [class.text-zinc-400]="r.id !== s.id"
                    [class.group-hover:border-zinc-400]="r.id !== s.id"
                    [class.group-hover:text-white]="r.id !== s.id"
                  >
                    {{ r.roundNumber }}
                  </div>
                  
                  <div class="ml-4 md:ml-0 md:mt-3 bg-zinc-900/80 border border-zinc-800/80 md:border-none p-3 rounded-lg md:p-0 flex-1">
                    <div class="font-semibold text-sm group-hover:text-zinc-200 transition-colors" [class.text-white]="r.id === s.id" [class.text-zinc-400]="r.id !== s.id">
                      Round {{ r.roundNumber }}
                      @if (r.id === s.id) {
                        <span class="text-[9px] uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700 px-1 rounded ml-1">Current</span>
                      }
                    </div>
                    <div class="text-xs text-zinc-500 mt-0.5">{{ r.createdAt | date: 'mediumDate' }}</div>
                    <div class="mt-1.5 flex justify-start md:justify-center">
                      <span class="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full" [class]="statusClass(r.status)">
                        {{ r.status }}
                      </span>
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- Details Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

          <!-- Core details -->
          <div class="md:col-span-2 space-y-6">

            <!-- Summary Card -->
            <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 class="text-lg font-bold text-white mb-4">Sample Details</h2>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                <div>
                  <span class="block text-zinc-500 font-medium mb-1">Supplier</span>
                  <span class="text-white font-semibold">{{ s.supplier?.name || '—' }}</span>
                  @if (s.supplier?.country) {
                    <span class="block text-xs text-zinc-400 mt-0.5">({{ s.supplier?.country }})</span>
                  }
                </div>
                <div>
                  <span class="block text-zinc-500 font-medium mb-1">Category</span>
                  <span class="text-white font-semibold capitalize">{{ s.category || '—' }}</span>
                </div>
                <div>
                  <span class="block text-zinc-500 font-medium mb-1">Created Date</span>
                  <span class="text-white font-semibold">{{ s.createdAt | date: 'medium' }}</span>
                </div>
                <div>
                  <span class="block text-zinc-500 font-medium mb-1">Status</span>
                  <span class="inline-block text-xs uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full border mt-0.5" [class]="statusClass(s.status)">
                    {{ s.status }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Comments / Notes -->
            <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 class="text-lg font-bold text-white mb-3">Comments & Evaluation</h2>
              <div class="text-sm leading-relaxed text-zinc-300 bg-zinc-950/40 p-4 rounded-lg border border-zinc-800/50 min-h-[80px]">
                {{ s.comments || 'No evaluation notes recorded for this round.' }}
              </div>
            </div>

            <!-- Construction Details (Optional, only for Balls) -->
            @if (s.category === 'football' || s.category === 'handball') {
              <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h2 class="text-lg font-bold text-white mb-4">Technical Specifications</h2>
                @if (s.construction && Object.keys(s.construction).length > 0) {
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    @for (entry of Object.entries(s.construction); track entry[0]) {
                      <div class="bg-zinc-950/40 border border-zinc-800/80 rounded-lg p-3">
                        <span class="block text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1">{{ entry[0] }}</span>
                        <span class="text-white text-sm font-semibold">{{ entry[1] }}</span>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="text-center py-6 bg-zinc-950/20 border border-dashed border-zinc-800 rounded-lg">
                    <p class="text-zinc-500 text-xs">No construction specifications defined.</p>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Sidebar details -->
          <div class="space-y-6">

            <!-- Logistics Card -->
            <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 class="text-lg font-bold text-white mb-4">Logistics Tracking</h2>
              <div class="space-y-4 text-sm">
                <div>
                  <span class="block text-zinc-500 font-medium mb-1">Carrier</span>
                  <span class="text-white font-semibold">{{ s.carrier || '—' }}</span>
                </div>
                <div>
                  <span class="block text-zinc-500 font-medium mb-1">Tracking Number</span>
                  @if (s.trackingNumber) {
                    <span class="text-white font-semibold font-mono bg-zinc-950 px-2 py-1 rounded border border-zinc-800 block mt-1 break-all select-all">
                      {{ s.trackingNumber }}
                    </span>
                  } @else {
                    <span class="text-zinc-400">—</span>
                  }
                </div>
              </div>
            </div>

            <!-- Tech Pack Card -->
            <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 class="text-lg font-bold text-white mb-4">Specs & Tech Pack</h2>
              @if (s.techPackPath) {
                <div class="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4 text-center">
                  <div class="text-3xl mb-2">📄</div>
                  <span class="block text-white text-xs font-semibold truncate mb-3" [title]="s.techPackName ?? ''">
                    {{ s.techPackName || 'tech-pack.pdf' }}
                  </span>
                  <button
                    (click)="downloadTechPack(s.techPackPath, s.techPackName || '')"
                    class="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-md border border-zinc-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Tech Pack
                  </button>
                </div>
              } @else {
                <div class="text-center py-6 bg-zinc-950/20 border border-dashed border-zinc-800 rounded-lg">
                  <p class="text-zinc-500 text-xs">No Tech Pack uploaded.</p>
                </div>
              }
            </div>

          </div>

        </div>

      }
    </div>
  `,
})
export class SampleDetailComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogService = inject(DialogService);

  sample = signal<Sample | null>(null);
  rounds = signal<Sample[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  readonly Object = Object;

  ngOnInit(): void {
    // Watch for route param change to re-load components when clicking timeline nodes
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.loadSampleDetails(+id);
      } else {
        this.error.set('Sample ID not specified.');
        this.loading.set(false);
      }
    });
  }

  private loadSampleDetails(id: number): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      sample: this.api.getSample(id),
      rounds: this.api.getSampleRounds(id)
    }).subscribe({
      next: ({ sample, rounds }) => {
        this.sample.set(sample);
        this.rounds.set(rounds);
        this.loading.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading sample detail:', err);
        this.error.set('Could not load sample details. It may not exist.');
        this.loading.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  isLatestRound(): boolean {
    const s = this.sample();
    if (!s) return false;
    // Check if any other round in the chain has a higher roundNumber
    return !this.rounds().some(r => (r.roundNumber || 1) > (s.roundNumber || 1));
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

  statusClass(status: string): string {
    switch (status) {
      case 'requested': return 'bg-zinc-800 text-zinc-400 border-zinc-700/50';
      case 'shipped': return 'bg-amber-900/40 text-amber-400 border-amber-800/30';
      case 'received': return 'bg-blue-900/40 text-blue-400 border-blue-800/30';
      case 'approved': return 'bg-emerald-950/60 text-emerald-400 border-emerald-900/30';
      case 'rejected': return 'bg-red-950/60 text-red-400 border-red-900/30';
      default: return 'bg-zinc-800 text-zinc-400 border-zinc-700/50';
    }
  }
}
