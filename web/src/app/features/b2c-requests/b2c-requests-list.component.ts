import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { B2cRequestsStore } from '../../store/b2c-requests.store';
import { B2cRequest, B2cChannelType, B2cStatusType } from '../../core/models/b2c-request.model';
import { DialogService } from '../../core/services/dialog.service';

@Component({
  selector: 'app-b2c-requests-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="p-8 max-w-7xl mx-auto">
      
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white">B2C Requests Tracker</h1>
          <p class="text-zinc-400 text-sm mt-1">Track customer requests from social media channels (WhatsApp, Instagram, Facebook) to notify them when stock arrives.</p>
        </div>
        
        <a
          routerLink="/b2c-requests/new"
          class="px-5 py-2.5 bg-white text-zinc-900 hover:bg-zinc-100 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
          </svg>
          Record Request
        </a>
      </div>

      <!-- Controls Card (Filters & Search) -->
      <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 mb-6 flex flex-col xl:flex-row gap-4 items-center justify-between">
        
        <!-- Status Filter Chips -->
        <div class="flex flex-wrap gap-2 items-center w-full xl:w-auto">
          <span class="text-xs text-zinc-500 uppercase tracking-wider font-semibold mr-2 font-mono">Status:</span>
          @for (filter of statusFilters; track filter.value) {
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

        <!-- Channel Filter Chips -->
        <div class="flex flex-wrap gap-2 items-center w-full xl:w-auto">
          <span class="text-xs text-zinc-500 uppercase tracking-wider font-semibold mr-2 font-mono">Channel:</span>
          @for (filter of channelFilters; track filter.value) {
            <button
              (click)="selectedChannelFilter.set(filter.value)"
              class="px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer"
              [class.bg-white]="selectedChannelFilter() === filter.value"
              [class.text-zinc-900]="selectedChannelFilter() === filter.value"
              [class.border-white]="selectedChannelFilter() === filter.value"
              [class.bg-zinc-800]="selectedChannelFilter() !== filter.value"
              [class.text-zinc-400]="selectedChannelFilter() !== filter.value"
              [class.border-zinc-800]="selectedChannelFilter() !== filter.value"
              [class.hover:text-white]="selectedChannelFilter() !== filter.value"
            >
              {{ filter.label }}
            </button>
          }
        </div>

        <!-- Search Box -->
        <div class="relative w-full xl:w-80">
          <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search by customer name or notes..."
            class="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg focus:outline-none focus:border-zinc-700 text-sm placeholder-zinc-500"
          />
        </div>

      </div>

      <!-- Requests Table Card -->
      <div class="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-zinc-900/60 border-b border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px]">
                <th class="p-4 font-semibold">Customer</th>
                <th class="p-4 font-semibold">Channel & Handle</th>
                <th class="p-4 font-semibold">Requested Item</th>
                <th class="p-4 font-semibold">Notes / Details</th>
                <th class="p-4 font-semibold text-center">Status</th>
                <th class="p-4 font-semibold text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-900">
              @for (req of filteredRequests(); track req.id) {
                <tr class="hover:bg-zinc-900/35 transition-colors">
                  <!-- Customer -->
                  <td class="p-4">
                    <div class="font-bold text-white text-sm">{{ req.customerName }}</div>
                    @if (req.phone) {
                      <span class="text-zinc-400 text-[10px] mt-0.5 block font-mono">{{ req.phone }}</span>
                    }
                    @if (req.email) {
                      <span class="text-zinc-500 text-[10px] block font-mono">{{ req.email }}</span>
                    }
                  </td>
                  
                  <!-- Channel -->
                  <td class="p-4">
                    <div class="flex items-center gap-1.5">
                      <span [class]="getChannelClass(req.channel)" class="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                        {{ req.channel }}
                      </span>
                      @if (req.channelUsername) {
                        <span class="text-zinc-300 text-xs font-semibold">{{ req.channelUsername }}</span>
                      }
                    </div>
                  </td>

                  <!-- Requested Item -->
                  <td class="p-4">
                    @if (req.product) {
                      <div class="font-semibold text-white">{{ req.product.name }}</div>
                      <div class="text-[10px] text-zinc-500 font-mono mt-0.5">{{ req.product.articleNumber }}</div>
                    } @else {
                      <span class="text-zinc-500 italic">No specific product linked</span>
                    }
                    <div class="flex gap-2 mt-1">
                      @if (req.requestedSize) {
                        <span class="bg-zinc-900 border border-zinc-800 text-zinc-400 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold">Size: {{ req.requestedSize }}</span>
                      }
                      @if (req.requestedColor) {
                        <span class="bg-zinc-900 border border-zinc-800 text-zinc-400 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold">Color: {{ req.requestedColor }}</span>
                      }
                      <span class="bg-zinc-900 border border-zinc-800 text-zinc-400 text-[9px] px-1.5 py-0.5 rounded font-bold">Qty: {{ req.quantity }}</span>
                    </div>
                  </td>
                  
                  <!-- Notes -->
                  <td class="p-4 text-zinc-400 max-w-xs truncate" [title]="req.notes || ''">
                    {{ req.notes || '—' }}
                  </td>

                  <!-- Status Badge -->
                  <td class="p-4 text-center">
                    <span [class]="getStatusClass(req.status)" class="px-2.5 py-1 rounded-full text-[10px] font-bold border capitalize">
                      {{ req.status }}
                    </span>
                  </td>
                  
                  <!-- Action buttons -->
                  <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                      @if (req.status === 'pending') {
                        <button
                          (click)="markAsNotified(req)"
                          class="px-2 py-1 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 text-[10px] font-bold rounded border border-emerald-800/60 transition-colors cursor-pointer"
                          title="Mark Notified"
                        >
                          Notify
                        </button>
                      }
                      <a
                        [routerLink]="['/b2c-requests', req.id, 'edit']"
                        class="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded transition-colors"
                        title="Edit Details"
                      >
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </a>
                      <button
                        (click)="confirmDelete(req.id)"
                        class="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-red-400 hover:text-red-300 rounded transition-colors cursor-pointer"
                        title="Delete Request"
                      >
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="p-8 text-center text-zinc-500 font-medium">
                    No B2C customer requests recorded matching the criteria.
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
export class B2cRequestsListComponent implements OnInit {
  readonly store = inject(B2cRequestsStore);
  private readonly dialogService = inject(DialogService);

  selectedStatusFilter = signal<string>('pending');
  selectedChannelFilter = signal<string>('all');
  searchQuery = signal<string>('');

  readonly statusFilters = [
    { label: 'Pending Notifications', value: 'pending' },
    { label: 'Notified', value: 'notified' },
    { label: 'Fulfilled', value: 'fulfilled' },
    { label: 'Cancelled', value: 'cancelled' },
    { label: 'All Requests', value: 'all' }
  ];

  readonly channelFilters = [
    { label: 'All Channels', value: 'all' },
    { label: 'WhatsApp', value: 'whatsapp' },
    { label: 'Instagram', value: 'instagram' },
    { label: 'Facebook', value: 'facebook' },
    { label: 'Other', value: 'other' }
  ];

  filteredRequests = computed(() => {
    let list = this.store.requests();

    // Filter by status
    const status = this.selectedStatusFilter();
    if (status !== 'all') {
      list = list.filter(r => r.status === status);
    }

    // Filter by channel
    const channel = this.selectedChannelFilter();
    if (channel !== 'all') {
      list = list.filter(r => r.channel === channel);
    }

    // Filter by search query
    const query = this.searchQuery().trim().toLowerCase();
    if (query) {
      list = list.filter(r => 
        r.customerName.toLowerCase().includes(query) || 
        (r.notes && r.notes.toLowerCase().includes(query)) ||
        (r.channelUsername && r.channelUsername.toLowerCase().includes(query)) ||
        (r.product && r.product.name.toLowerCase().includes(query))
      );
    }

    return list;
  });

  ngOnInit(): void {
    this.store.loadRequests();
  }

  async markAsNotified(req: B2cRequest): Promise<void> {
    const ok = await this.dialogService.confirm('Notify Customer', `Mark customer ${req.customerName} as notified?`);
    if (ok) {
      this.store.updateRequest({ id: req.id, dto: { status: 'notified' } });
    }
  }

  async confirmDelete(id: number): Promise<void> {
    const ok = await this.dialogService.confirm('Delete Request', 'Are you sure you want to delete this customer request?');
    if (ok) {
      this.store.deleteRequest(id);
    }
  }

  getChannelClass(channel: string): string {
    switch (channel) {
      case 'instagram':
        return 'bg-pink-950/60 text-pink-400 border border-pink-900/60';
      case 'facebook':
        return 'bg-blue-950/60 text-blue-400 border border-blue-900/60';
      case 'whatsapp':
        return 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/60';
      default:
        return 'bg-zinc-800 text-zinc-400';
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'pending':
        return 'bg-amber-950/40 text-amber-400 border-amber-800/60';
      case 'notified':
        return 'bg-blue-950/40 text-blue-400 border-blue-800/60';
      case 'fulfilled':
        return 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60';
      case 'cancelled':
        return 'bg-zinc-900/50 text-zinc-500 border-zinc-800/60';
      default:
        return 'bg-zinc-800/50 text-zinc-400 border-zinc-700/60';
    }
  }
}
