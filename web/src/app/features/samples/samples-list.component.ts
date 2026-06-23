import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SamplesStore } from '../../store/samples.store';
import { ApiService } from '../../core/services/api.service';
import { DialogService } from '../../core/services/dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-samples-list',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './samples-list.component.html',
})
export class SamplesListComponent implements OnInit {
  readonly store = inject(SamplesStore);
  readonly authService = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly dialogService = inject(DialogService);
  readonly Object = Object;

  ngOnInit(): void {
    this.store.loadSamples();
  }

  async delete(id: number): Promise<void> {
    const ok = await this.dialogService.confirm('Delete Sample', 'Are you sure you want to delete this sample record?');
    if (ok) {
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
      case 'requested': return 'bg-zinc-800 text-zinc-400';
      case 'shipped': return 'bg-amber-900/40 text-amber-400 border border-amber-800/30';
      case 'received': return 'bg-blue-900/40 text-blue-400 border border-blue-800/30';
      case 'approved': return 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/30';
      case 'rejected': return 'bg-red-950/60 text-red-400 border border-red-900/30';
      default: return 'bg-zinc-800 text-zinc-400';
    }
  }
}
