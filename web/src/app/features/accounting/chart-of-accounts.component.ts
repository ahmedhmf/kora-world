import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingStore } from '../../store/accounting.store';
import { AccountingAccount } from '../../core/services/accounting-api.service';

@Component({
  selector: 'app-chart-of-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-8 max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white">Chart of Accounts</h1>
          <p class="text-zinc-400 text-sm mt-1">Manage and track your general ledger structure.</p>
        </div>
        <button
          (click)="openCreateModal()"
          class="px-5 py-2.5 bg-white text-zinc-900 hover:bg-zinc-100 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
          </svg>
          Add Account
        </button>
      </div>

      <!-- Main Content Tree View -->
      <div class="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl p-6">
        <div class="overflow-x-auto">
          <div class="min-w-[800px]">
            <!-- Column Headers -->
            <div class="grid grid-cols-12 gap-4 pb-3 border-b border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px] font-semibold px-4">
              <div class="col-span-5">Code & Name</div>
              <div class="col-span-3 text-center">Type</div>
              <div class="col-span-2 text-center">Currency</div>
              <div class="col-span-2 text-right">Status</div>
            </div>

            <!-- Roots & Children Loop -->
            <div class="divide-y divide-zinc-900 mt-2">
              @for (account of store.accountTree(); track account.id) {
                <ng-container *ngTemplateOutlet="accountRow; context: { $implicit: account, level: 0 }"></ng-container>
              } @empty {
                <div class="p-10 text-center text-zinc-500 font-medium">
                  Loading chart of accounts...
                </div>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Recursive Row Template -->
      <ng-template #accountRow let-acc let-level="level">
        <div class="hover:bg-zinc-900/30 transition-colors">
          <div 
            class="grid grid-cols-12 gap-4 py-3.5 px-4 items-center text-xs border-b border-zinc-900"
            [style.padding-left.px]="level * 24 + 16"
          >
            <div class="col-span-5 flex items-center gap-2">
              <!-- Expand/Collapse Button if children exist -->
              @if (acc.children && acc.children.length > 0) {
                <button 
                  (click)="toggleCollapse(acc.id)"
                  class="text-zinc-500 hover:text-white transition-colors cursor-pointer w-4 h-4 flex items-center justify-center"
                >
                  <span>{{ isCollapsed(acc.id) ? '▶' : '▼' }}</span>
                </button>
              } @else {
                <span class="w-4"></span>
              }
              <span class="font-mono font-bold text-zinc-300 mr-2">{{ acc.code }}</span>
              <span class="text-white font-semibold">{{ acc.name }}</span>
            </div>
            
            <div class="col-span-3 text-center">
              <span [class]="getTypeClass(acc.type)" class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border">
                {{ acc.type }}
              </span>
            </div>
            
            <div class="col-span-2 text-center font-mono font-bold text-zinc-400">
              {{ acc.currency }}
            </div>
            
            <div class="col-span-2 text-right">
              <span [class]="acc.isActive ? 'text-emerald-400 bg-emerald-950/20 border-emerald-800/40' : 'text-zinc-500 bg-zinc-800/30 border-zinc-700/40'" class="px-2 py-0.5 rounded text-[10px] font-semibold border">
                {{ acc.isActive ? 'Active' : 'Inactive' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Render Children Recursively -->
        @if (acc.children && acc.children.length > 0 && !isCollapsed(acc.id)) {
          @for (child of acc.children; track child.id) {
            <ng-container *ngTemplateOutlet="accountRow; context: { $implicit: child, level: level + 1 }"></ng-container>
          }
        }
      </ng-template>

      <!-- Create Account Modal -->
      @if (isCreateModalOpen()) {
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-black border border-zinc-800 rounded-xl max-w-md w-full overflow-hidden shadow-2xl">
            <!-- Modal Header -->
            <div class="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
              <h3 class="font-bold text-white text-base">📊 Add New Account</h3>
              <button (click)="isCreateModalOpen.set(false)" class="text-zinc-500 hover:text-white text-lg font-bold transition-colors cursor-pointer focus:outline-none">&times;</button>
            </div>
            
            <!-- Modal Body -->
            <div class="p-6 space-y-4">
              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-zinc-400">Account Code</label>
                <input 
                  type="text" 
                  [(ngModel)]="newAccount.code" 
                  class="w-full bg-zinc-950 border border-zinc-850 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-700 placeholder-zinc-700"
                  placeholder="e.g. 1104"
                />
              </div>

              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-zinc-400">Account Name</label>
                <input 
                  type="text" 
                  [(ngModel)]="newAccount.name" 
                  class="w-full bg-zinc-950 border border-zinc-850 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-700 placeholder-zinc-700"
                  placeholder="e.g. PayPal Cash Account"
                />
              </div>

              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-zinc-400">Account Type</label>
                <select 
                  [(ngModel)]="newAccount.type" 
                  class="w-full bg-zinc-950 border border-zinc-850 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-700"
                >
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                  <option value="equity">Equity</option>
                  <option value="revenue">Revenue</option>
                  <option value="expense">Expense</option>
                </select>
              </div>

              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-zinc-400">Currency</label>
                <select 
                  [(ngModel)]="newAccount.currency" 
                  class="w-full bg-zinc-950 border border-zinc-850 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-700"
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="EGP">EGP</option>
                </select>
              </div>

              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-zinc-400">Parent Account (Optional)</label>
                <select 
                  [(ngModel)]="newAccount.parentId" 
                  class="w-full bg-zinc-950 border border-zinc-850 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-700"
                >
                  <option [ngValue]="null">None</option>
                  @for (acc of store.accounts(); track acc.id) {
                    <option [ngValue]="acc.id">{{ acc.code }} - {{ acc.name }}</option>
                  }
                </select>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="px-6 py-4 border-t border-zinc-800 bg-zinc-950 flex justify-end gap-3">
              <button 
                (click)="isCreateModalOpen.set(false)" 
                class="px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-white rounded text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                (click)="submitCreateAccount()" 
                class="px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-900 rounded font-semibold text-xs transition-colors cursor-pointer"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
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
