import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingStore } from '../../store/accounting.store';
import { AccountingAccount } from '../../core/services/accounting-api.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-chart-of-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './chart-of-accounts.component.html',
})
export class ChartOfAccountsComponent implements OnInit {
  readonly store = inject(AccountingStore);

  collapsedMap = signal<Record<number, boolean>>({});
  isCreateModalOpen = signal(false);

  newAccount = {
    code: '',
    name: '',
    type: 'asset',
    currency: 'EUR',
    parentId: null as number | null,
  };

  ngOnInit() {
    this.store.loadAccounts();
    this.store.loadAccountTree();
  }

  toggleCollapse(id: number) {
    this.collapsedMap.update(map => ({
      ...map,
      [id]: !map[id]
    }));
  }

  isCollapsed(id: number): boolean {
    return !!this.collapsedMap()[id];
  }

  getTypeClass(type: string): string {
    switch (type.toLowerCase()) {
      case 'asset':     return 'bg-blue-950/30 text-blue-400 border-blue-900/40';
      case 'liability': return 'bg-red-950/30 text-red-400 border-red-900/40';
      case 'equity':    return 'bg-purple-950/30 text-purple-400 border-purple-900/40';
      case 'revenue':   return 'bg-emerald-950/30 text-emerald-400 border-emerald-900/40';
      case 'expense':   return 'bg-amber-950/30 text-amber-400 border-amber-900/40';
      default:          return 'bg-zinc-800/30 text-zinc-400 border-zinc-700/40';
    }
  }

  openCreateModal() {
    this.newAccount = {
      code: '',
      name: '',
      type: 'asset',
      currency: 'EUR',
      parentId: null,
    };
    this.isCreateModalOpen.set(true);
  }

  submitCreateAccount() {
    if (!this.newAccount.code || !this.newAccount.name) return;
    this.store.createAccount({
      ...this.newAccount,
      parentId: this.newAccount.parentId ? Number(this.newAccount.parentId) : null,
    });
    this.isCreateModalOpen.set(false);
    // Reload tree
    setTimeout(() => {
      this.store.loadAccountTree();
    }, 500);
  }
}
