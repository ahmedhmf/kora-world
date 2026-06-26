import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AccountsStore } from '../../store/accounts.store';
import { B2BAccount, AccountStatus } from '../../core/models/account.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-accounts-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './accounts-list.component.html'
})
export class AccountsListComponent implements OnInit {
  readonly store = inject(AccountsStore);
  readonly authService = inject(AuthService);

  selectedStatusFilter = signal<string>('all');
  searchQuery = signal<string>('');

  readonly filterOptions = [
    { label: 'All Accounts', value: 'all' },
    { label: 'Under Discussion', value: 'under_discussion' },
    { label: 'Active', value: 'active' },
    { label: 'Suspended', value: 'suspended' },
    { label: 'Inactive', value: 'inactive' }
  ];

  filteredAccounts = computed(() => {
    let list = this.store.accounts();

    // Filter by status
    const filter = this.selectedStatusFilter();
    if (filter !== 'all') {
      list = list.filter(a => a.status === filter);
    }

    // Filter by search query
    const query = this.searchQuery().trim().toLowerCase();
    if (query) {
      list = list.filter(a => 
        a.companyName.toLowerCase().includes(query) || 
        a.primaryContactEmail.toLowerCase().includes(query) || 
        a.primaryContactName.toLowerCase().includes(query) ||
        a.accountNumber.toLowerCase().includes(query)
      );
    }

    return list;
  });

  ngOnInit(): void {
    this.store.loadAccounts();
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'active':
        return 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60';
      case 'under_discussion':
        return 'bg-amber-950/40 text-amber-400 border-amber-800/60';
      case 'suspended':
        return 'bg-red-950/40 text-red-400 border-red-800/60';
      case 'inactive':
      default:
        return 'bg-zinc-800/50 text-zinc-400 border-zinc-700/60';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'active':
        return 'Active';
      case 'under_discussion':
        return 'Under Discussion';
      case 'suspended':
        return 'Suspended';
      case 'inactive':
        return 'Inactive';
      default:
        return status;
    }
  }
}
