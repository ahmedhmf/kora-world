import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ReceiptsStore } from '../../store/receipts.store';
import { Receipt, ReceiptStatus } from '../../core/models/receipt.model';

@Component({
  selector: 'app-receipts-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="p-8 max-w-7xl mx-auto">

      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white">Sales Receipts</h1>
          <p class="text-zinc-400 text-sm mt-1">Issue and track receipts for B2B accounts.</p>
        </div>
        <a
          routerLink="/receipts/new"
          class="px-5 py-2.5 bg-white text-zinc-900 hover:bg-zinc-100 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
          </svg>
          New Receipt
        </a>
      </div>

      <!-- Summary Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        @for (stat of summaryStats(); track stat.label) {
          <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
            <p class="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-1">{{ stat.label }}</p>
            <p class="text-white text-xl font-bold">{{ stat.value }}</p>
          </div>
        }
      </div>

      <!-- Controls -->
      <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <!-- Status Chips -->
        <div class="flex flex-wrap gap-2 items-center w-full md:w-auto">
          <span class="text-xs text-zinc-500 uppercase tracking-wider font-semibold mr-2">Status:</span>
          @for (f of filterOptions; track f.value) {
            <button
              (click)="selectedStatus.set(f.value)"
              class="px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer"
              [class.bg-white]="selectedStatus() === f.value"
              [class.text-zinc-900]="selectedStatus() === f.value"
              [class.border-white]="selectedStatus() === f.value"
              [class.bg-zinc-800]="selectedStatus() !== f.value"
              [class.text-zinc-400]="selectedStatus() !== f.value"
              [class.border-zinc-800]="selectedStatus() !== f.value"
            >{{ f.label }}</button>
          }
        </div>
        <!-- Search -->
        <div class="relative w-full md:w-72">
          <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search by receipt # or company..."
            class="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg focus:outline-none focus:border-zinc-700 text-sm placeholder-zinc-500"
          />
        </div>
      </div>

      <!-- Table -->
      <div class="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-zinc-900/60 border-b border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px]">
                <th class="p-4 font-semibold">Receipt #</th>
                <th class="p-4 font-semibold">Account</th>
                <th class="p-4 font-semibold">Issue Date</th>
                <th class="p-4 font-semibold">Due Date</th>
                <th class="p-4 font-semibold text-right">Amount</th>
                <th class="p-4 font-semibold text-center">Status</th>
                <th class="p-4 font-semibold text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-900">
              @for (r of filteredReceipts(); track r.id) {
                <tr class="hover:bg-zinc-900/35 transition-colors">
                  <td class="p-4 font-mono font-bold text-zinc-300 text-xs">
                    <a [routerLink]="['/receipts', r.id]" class="hover:text-white transition-colors">
                      {{ r.receiptNumber }}
                    </a>
                  </td>
                  <td class="p-4">
                    <div class="font-semibold text-white">{{ r.account?.companyName }}</div>
                    <div class="text-zinc-500 text-[10px]">{{ r.account?.customerType }}</div>
                  </td>
                  <td class="p-4 text-zinc-300">{{ r.issueDate | date:'dd MMM yyyy' }}</td>
                  <td class="p-4">
                    @if (r.dueDate) {
                      <span [class]="isOverdue(r) ? 'text-red-400' : 'text-zinc-300'">
                        {{ r.dueDate | date:'dd MMM yyyy' }}
                      </span>
                    } @else {
                      <span class="text-zinc-600">—</span>
                    }
                  </td>
                  <td class="p-4 text-right font-mono font-bold text-zinc-100">
                    {{ r.totalAmount | currency: r.currency:'symbol':'1.2-2' }}
                  </td>
                  <td class="p-4 text-center">
                    <span [class]="getStatusClass(r.status)" class="px-2.5 py-1 rounded-full text-[10px] font-bold border">
                      {{ getStatusLabel(r.status) }}
                    </span>
                  </td>
                  <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                      <a [routerLink]="['/receipts', r.id]" class="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded transition-colors" title="View">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </a>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="p-10 text-center text-zinc-500 font-medium">
                    No receipts found.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `,
})
export class ReceiptsListComponent implements OnInit {
  readonly store = inject(ReceiptsStore);

  selectedStatus = signal<string>('all');
  searchQuery = signal<string>('');

  readonly filterOptions = [
    { label: 'All', value: 'all' },
    { label: 'Draft', value: 'draft' },
    { label: 'Issued', value: 'issued' },
    { label: 'Paid', value: 'paid' },
    { label: 'Overdue', value: 'overdue' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  filteredReceipts = computed(() => {
    let list = this.store.receipts();
    const status = this.selectedStatus();
    if (status !== 'all') list = list.filter((r) => r.status === status);
    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.receiptNumber.toLowerCase().includes(q) ||
          r.account?.companyName?.toLowerCase().includes(q)
      );
    }
    return list;
  });

  summaryStats = computed(() => {
    const all = this.store.receipts();
    const totalValue = all
      .filter((r) => r.status !== 'cancelled')
      .reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    const paid = all.filter((r) => r.status === 'paid').reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    return [
      { label: 'Total Receipts', value: all.length.toString() },
      { label: 'Draft', value: all.filter((r) => r.status === 'draft').length.toString() },
      { label: 'Outstanding', value: `$${(totalValue - paid).toLocaleString('en', { maximumFractionDigits: 0 })}` },
      { label: 'Paid', value: all.filter((r) => r.status === 'paid').length.toString() },
    ];
  });

  ngOnInit(): void {
    this.store.loadReceipts();
  }

  isOverdue(r: Receipt): boolean {
    if (!r.dueDate || r.status === 'paid' || r.status === 'cancelled') return false;
    return new Date(r.dueDate) < new Date();
  }

  getStatusClass(status: ReceiptStatus): string {
    switch (status) {
      case 'paid':       return 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60';
      case 'issued':     return 'bg-blue-950/40 text-blue-400 border-blue-800/60';
      case 'draft':      return 'bg-zinc-800/50 text-zinc-400 border-zinc-700/60';
      case 'overdue':    return 'bg-red-950/40 text-red-400 border-red-800/60';
      case 'cancelled':  return 'bg-zinc-900/50 text-zinc-600 border-zinc-800/60';
      default:           return 'bg-zinc-800/50 text-zinc-400 border-zinc-700/60';
    }
  }

  getStatusLabel(status: ReceiptStatus): string {
    const labels: Record<ReceiptStatus, string> = {
      draft: 'Draft', issued: 'Issued', paid: 'Paid', overdue: 'Overdue', cancelled: 'Cancelled',
    };
    return labels[status] ?? status;
  }
}
