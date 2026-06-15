import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AccountsStore } from '../../store/accounts.store';
import { B2BAccount, AccountStatus } from '../../core/models/account.model';

@Component({
  selector: 'app-accounts-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="p-8 max-w-7xl mx-auto">
      
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white">B2B Accounts</h1>
          <p class="text-zinc-400 text-sm mt-1">Manage B2B customers, credit configurations, and onboarding discussions.</p>
        </div>
        
        <a
          routerLink="/accounts/new"
          class="px-5 py-2.5 bg-white text-zinc-900 hover:bg-zinc-100 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
          </svg>
          Add Account
        </a>
      </div>

      <!-- Controls Card (Filters & Search) -->
      <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        
        <!-- Status Filter Chips -->
        <div class="flex flex-wrap gap-2 items-center w-full md:w-auto">
          <span class="text-xs text-zinc-500 uppercase tracking-wider font-semibold mr-2">Status:</span>
          @for (filter of filterOptions; track filter.value) {
            <button
              (click)="selectedStatusFilter.set(filter.value)"
              class="px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer"
              [class.bg-white]="selectedStatusFilter() === filter.value"
              [class.text-zinc-900]="selectedStatusFilter() === filter.value"
              [class.border-white]="selectedStatusFilter() === filter.value"
              [class.bg-zinc-800]="selectedStatusFilter() !== filter.value"
              [class.text-zinc-400]="selectedStatusFilter() !== filter.value"
              [class.border-zinc-800]="selectedStatusFilter() !== filter.value"
              [class.hover:text-white]="selectedStatusFilter() !== filter.value"
            >
              {{ filter.label }}
            </button>
          }
        </div>

        <!-- Search Box -->
        <div class="relative w-full md:w-80">
          <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search by company or email..."
            class="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg focus:outline-none focus:border-zinc-700 text-sm placeholder-zinc-500"
          />
        </div>

      </div>

      <!-- Accounts Table Card -->
      <div class="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-zinc-900/60 border-b border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px]">
                <th class="p-4 font-semibold w-24">Account ID</th>
                <th class="p-4 font-semibold">Company Name</th>
                <th class="p-4 font-semibold">Primary Contact</th>
                <th class="p-4 font-semibold">Type</th>
                <th class="p-4 font-semibold text-right">Credit Limit</th>
                <th class="p-4 font-semibold text-center">Status</th>
                <th class="p-4 font-semibold text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-900">
              @for (account of filteredAccounts(); track account.id) {
                <tr class="hover:bg-zinc-900/35 transition-colors">
                  <!-- Account ID -->
                  <td class="p-4 font-mono font-bold text-zinc-400">
                    {{ account.accountNumber }}
                  </td>
                  
                  <!-- Company Name -->
                  <td class="p-4">
                    <div class="font-bold text-white text-sm hover:underline">
                      <a [routerLink]="['/accounts', account.id]">{{ account.companyName }}</a>
                    </div>
                    @if (account.website) {
                      <a [href]="account.website" target="_blank" class="text-zinc-500 hover:text-zinc-300 text-[10px] block mt-0.5">{{ account.website }}</a>
                    }
                  </td>
                  
                  <!-- Primary Contact -->
                  <td class="p-4">
                    <div class="font-semibold text-white">{{ account.primaryContactName }}</div>
                    <div class="text-zinc-500">{{ account.primaryContactEmail }}</div>
                  </td>
                  
                  <!-- Type -->
                  <td class="p-4 font-medium text-zinc-300">
                    {{ account.customerType }}
                  </td>
                  
                  <!-- Credit Limit -->
                  <td class="p-4 text-right font-mono font-bold text-zinc-200">
                    {{ account.creditLimit | currency: account.defaultCurrency:'symbol':'1.2-2' }}
                  </td>
                  
                  <!-- Status Badge -->
                  <td class="p-4 text-center">
                    <span [class]="getStatusClass(account.status)" class="px-2.5 py-1 rounded-full text-[10px] font-bold border">
                      {{ getStatusLabel(account.status) }}
                    </span>
                  </td>
                  
                  <!-- Action buttons -->
                  <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                      <a
                        [routerLink]="['/accounts', account.id]"
                        class="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded transition-colors"
                        title="View Details"
                      >
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </a>
                      <a
                        [routerLink]="['/accounts', account.id, 'edit']"
                        class="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded transition-colors"
                        title="Edit Details"
                      >
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </a>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="p-8 text-center text-zinc-500 font-medium">
                    No B2B accounts found matching the criteria.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `
})
export class AccountsListComponent implements OnInit {
  readonly store = inject(AccountsStore);

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
