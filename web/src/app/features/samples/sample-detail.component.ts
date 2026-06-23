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
  templateUrl: './sample-detail.component.html',
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
