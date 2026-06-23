import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ContactsStore } from '../../store/contacts.store';
import { Contact, ContactType } from '../../core/models/contact.model';

@Component({
  selector: 'app-contacts-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './contacts-list.component.html'
})
export class ContactsListComponent implements OnInit {
  readonly store = inject(ContactsStore);

  selectedTypeFilter = signal<string>('all');
  searchQuery = signal<string>('');

  readonly filterOptions = [
    { label: 'All', value: 'all' },
    { label: 'Marketing', value: 'marketing' },
    { label: 'Legal', value: 'legal' },
    { label: 'Finance', value: 'finance' },
    { label: 'Suppliers', value: 'supplier' },
    { label: 'Accounts', value: 'account' },
    { label: 'Drivers', value: 'driver' },
    { label: 'Warehouses', value: 'warehouse' }
  ];

  filteredContacts = computed(() => {
    let list = this.store.contacts();

    // Filter by type
    const typeFilter = this.selectedTypeFilter();
    if (typeFilter !== 'all') {
      list = list.filter(c => c.type === typeFilter);
    }

    // Filter by search query
    const query = this.searchQuery().trim().toLowerCase();
    if (query) {
      list = list.filter(c => 
        c.name.toLowerCase().includes(query) || 
        (c.company && c.company.toLowerCase().includes(query)) ||
        (c.email && c.email.toLowerCase().includes(query)) ||
        (c.supplier && c.supplier.name.toLowerCase().includes(query)) ||
        (c.account && c.account.companyName.toLowerCase().includes(query))
      );
    }

    return list;
  });

  ngOnInit(): void {
    this.store.loadContacts();
  }

  getTypeClass(type: string): string {
    switch (type) {
      case 'marketing':
        return 'bg-purple-950/40 text-purple-400 border-purple-800/60';
      case 'legal':
        return 'bg-red-950/40 text-red-400 border-red-800/60';
      case 'finance':
        return 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60';
      case 'supplier':
        return 'bg-blue-950/40 text-blue-400 border-blue-800/60';
      case 'account':
        return 'bg-amber-950/40 text-amber-400 border-amber-800/60';
      case 'driver':
        return 'bg-cyan-950/40 text-cyan-400 border-cyan-800/60';
      case 'warehouse':
        return 'bg-teal-950/40 text-teal-400 border-teal-800/60';
      default:
        return 'bg-zinc-800/50 text-zinc-400 border-zinc-700/60';
    }
  }
}
