import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AccountsStore } from '../../store/accounts.store';
import { B2BAccount, AccountStatus } from '../../core/models/account.model';
import { DialogService } from '../../core/services/dialog.service';

@Component({
  selector: 'app-account-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './account-detail.component.html',
})
export class AccountDetailComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly store = inject(AccountsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);

  account = signal<B2BAccount | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.loading.set(true);
        this.api.getAccount(+id).subscribe({
          next: (acct) => {
            this.account.set(acct);
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
}
