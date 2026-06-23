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
  templateUrl: './b2c-requests-list.component.html'
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
