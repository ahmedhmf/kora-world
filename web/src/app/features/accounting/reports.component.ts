import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingStore } from '../../store/accounting.store';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-8 max-w-7xl mx-auto">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-white">Financial Statements & Reports</h1>
        <p class="text-zinc-400 text-sm mt-1">Review profitability, balance sheet liquidity, and cash movements.</p>
      </div>

      <!-- Tabs Navigation -->
      <div class="flex border-b border-zinc-800 mb-6 gap-2 shrink-0">
        @for (tab of tabs; track tab.id) {
          <button
            (click)="activeTab.set(tab.id)"
            class="px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer focus:outline-none"
            [class.border-white]="activeTab() === tab.id"
            [class.text-white]="activeTab() === tab.id"
            [class.border-transparent]="activeTab() !== tab.id"
            [class.text-zinc-550]="activeTab() !== tab.id"
            [class.hover:text-zinc-300]="activeTab() !== tab.id"
          >
            {{ tab.label }}
          </button>
        }
      </div>

      <!-- Controls (Parameters Card) -->
      <div class="bg-zinc-950 border border-zinc-800 rounded-xl p-5 mb-8 flex flex-col md:flex-row gap-4 items-end">
        @if (activeTab() === 'pl' || activeTab() === 'cf') {
          <div class="space-y-1 w-full md:w-auto">
            <label class="block text-[10px] text-zinc-550 uppercase tracking-wider font-bold">Start Date</label>
            <input 
              type="date" 
              [(ngModel)]="startDate"
              class="w-full md:w-44 bg-zinc-900 border border-zinc-850 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-700 font-mono"
            />
          </div>
          <div class="space-y-1 w-full md:w-auto">
            <label class="block text-[10px] text-zinc-550 uppercase tracking-wider font-bold">End Date</label>
            <input 
              type="date" 
              [(ngModel)]="endDate"
              class="w-full md:w-44 bg-zinc-900 border border-zinc-850 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-700 font-mono"
            />
          </div>
          @if (activeTab() === 'pl') {
            <div class="space-y-1 w-full md:w-auto">
              <label class="block text-[10px] text-zinc-550 uppercase tracking-wider font-bold">Display Currency</label>
              <select 
                [(ngModel)]="currency"
                class="w-full md:w-28 bg-zinc-900 border border-zinc-850 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-700 font-mono uppercase font-bold"
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="EGP">EGP</option>
              </select>
            </div>
          }
        } @else if (activeTab() === 'bs') {
          <div class="space-y-1 w-full md:w-auto">
            <label class="block text-[10px] text-zinc-550 uppercase tracking-wider font-bold">As of Date</label>
            <input 
              type="date" 
              [(ngModel)]="asOfDate"
              class="w-full md:w-48 bg-zinc-900 border border-zinc-850 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-700 font-mono"
            />
          </div>
        }

        <button
          (click)="runReport()"
          class="w-full md:w-auto px-5 py-2 bg-white text-zinc-900 hover:bg-zinc-100 text-xs font-bold rounded-lg transition-colors cursor-pointer"
        >
          Generate Report
        </button>
      </div>

      <!-- Report Display Card -->
      <div class="bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-2xl">
        <!-- 1. PROFIT & LOSS -->
        @if (activeTab() === 'pl') {
          @if (store.profitLoss(); as pl) {
            <div class="space-y-6">
              <div class="border-b border-zinc-900 pb-3 flex justify-between items-center">
                <h3 class="text-base font-bold text-white uppercase tracking-wider">Profit & Loss Statement</h3>
                <span class="text-xs text-zinc-500 font-mono">Currency: {{ pl.currency }}</span>
              </div>

              <!-- Revenue Section -->
              <div class="space-y-2">
                <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">1. Revenue</h4>
                <div class="space-y-1 px-3">
                  @for (rev of pl.revenue; track rev.code) {
                    <div class="flex justify-between text-xs py-1.5 border-b border-zinc-900/60 font-medium">
                      <span class="text-zinc-300">{{ rev.code }} - {{ rev.name }}</span>
                      <span class="text-white font-mono font-bold">{{ rev.amount | number:'1.2-2' }}</span>
                    </div>
                  } @empty {
                    <p class="text-xs text-zinc-650 italic">No revenue recorded in this period.</p>
                  }
                </div>
              </div>

              <!-- Expenses Section -->
              <div class="space-y-2">
                <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">2. Expenses</h4>
                <div class="space-y-1 px-3">
                  @for (exp of pl.expenses; track exp.code) {
                    <div class="flex justify-between text-xs py-1.5 border-b border-zinc-900/60 font-medium">
                      <span class="text-zinc-300">{{ exp.code }} - {{ exp.name }}</span>
                      <span class="text-white font-mono font-bold">{{ exp.amount | number:'1.2-2' }}</span>
                    </div>
                  } @empty {
                    <p class="text-xs text-zinc-650 italic">No expenses recorded in this period.</p>
                  }
                </div>
              </div>

              <!-- Net Income -->
              <div class="border-t border-zinc-800 pt-4 space-y-2 mt-4">
                <div class="flex justify-between text-sm font-bold bg-zinc-900/40 p-3 rounded-lg border border-zinc-900">
                  <span class="text-zinc-400 uppercase tracking-wider">Gross Profit (Rev - COGS)</span>
                  <span class="text-white font-mono">{{ pl.grossProfit | number:'1.2-2' }}</span>
                </div>
                <div class="flex justify-between text-sm font-bold bg-zinc-900/70 p-3 rounded-lg border border-zinc-800">
                  <span class="text-zinc-200 uppercase tracking-wider">Net Profit / Net Income</span>
                  <span [class.text-emerald-400]="pl.netProfit >= 0" [class.text-red-400]="pl.netProfit < 0" class="font-mono">
                    {{ pl.netProfit | number:'1.2-2' }}
                  </span>
                </div>
              </div>
            </div>
          } @else {
            <p class="text-xs text-zinc-500 text-center py-10 font-medium">Configure date parameters and click Generate Report.</p>
          }
        }

        <!-- 2. BALANCE SHEET -->
        @if (activeTab() === 'bs') {
          @if (store.balanceSheet(); as bs) {
            <div class="space-y-6">
              <div class="border-b border-zinc-900 pb-3 flex justify-between items-center">
                <h3 class="text-base font-bold text-white uppercase tracking-wider">Balance Sheet</h3>
                <div class="flex gap-2 items-center text-xs">
                  <span class="text-zinc-500 font-mono">Statement as of: {{ asOfDate }}</span>
                  <span [class]="bs.isBalanced ? 'bg-emerald-950/45 text-emerald-400 border-emerald-800/40' : 'bg-red-950/45 text-red-400 border-red-800/40'" class="px-2 py-0.5 rounded text-[10px] font-bold border">
                    {{ bs.isBalanced ? 'Balanced' : 'Unbalanced' }}
                  </span>
                </div>
              </div>

              <!-- Assets -->
              <div class="space-y-2">
                <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Assets</h4>
                <div class="space-y-1 px-3">
                  @for (asset of bs.assets; track asset.code) {
                    <div class="flex justify-between text-xs py-1.5 border-b border-zinc-900/60 font-medium">
                      <span class="text-zinc-300">{{ asset.code }} - {{ asset.name }}</span>
                      <span class="text-white font-mono font-bold">{{ asset.balance | number:'1.2-2' }}</span>
                    </div>
                  }
                  <div class="flex justify-between text-xs font-bold py-2 text-zinc-400 mt-2 border-t border-zinc-900 uppercase">
                    <span>Total Assets</span>
                    <span class="text-white font-mono font-bold">{{ bs.totalAssets | number:'1.2-2' }}</span>
                  </div>
                </div>
              </div>

              <!-- Liabilities -->
              <div class="space-y-2">
                <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Liabilities</h4>
                <div class="space-y-1 px-3">
                  @for (liab of bs.liabilities; track liab.code) {
                    <div class="flex justify-between text-xs py-1.5 border-b border-zinc-900/60 font-medium">
                      <span class="text-zinc-300">{{ liab.code }} - {{ liab.name }}</span>
                      <span class="text-white font-mono font-bold">{{ liab.balance | number:'1.2-2' }}</span>
                    </div>
                  }
                  <div class="flex justify-between text-xs font-bold py-2 text-zinc-400 mt-2 border-t border-zinc-900 uppercase">
                    <span>Total Liabilities</span>
                    <span class="text-white font-mono font-bold">{{ bs.totalLiabilities | number:'1.2-2' }}</span>
                  </div>
                </div>
              </div>

              <!-- Equity -->
              <div class="space-y-2">
                <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Equity</h4>
                <div class="space-y-1 px-3">
                  @for (eq of bs.equity; track eq.code) {
                    <div class="flex justify-between text-xs py-1.5 border-b border-zinc-900/60 font-medium">
                      <span class="text-zinc-300">{{ eq.code }} - {{ eq.name }}</span>
                      <span class="text-white font-mono font-bold">{{ eq.balance | number:'1.2-2' }}</span>
                    </div>
                  }
                  <div class="flex justify-between text-xs font-bold py-2 text-zinc-400 mt-2 border-t border-zinc-900 uppercase">
                    <span>Total Equity</span>
                    <span class="text-white font-mono font-bold">{{ bs.totalEquity | number:'1.2-2' }}</span>
                  </div>
                </div>
              </div>

              <!-- Check Balance Ticker -->
              <div class="border-t border-zinc-800 pt-4 text-xs font-mono text-zinc-500 flex justify-between bg-zinc-900/40 p-3 rounded-lg border border-zinc-900">
                <span>Assets matches Liabilities + Equity check:</span>
                <span [class.text-emerald-400]="bs.isBalanced" [class.text-red-400]="!bs.isBalanced" class="font-bold">
                  {{ bs.totalAssets | number:'1.2-2' }} vs {{ bs.totalLiabilities + bs.totalEquity | number:'1.2-2' }} (Diff: {{ bs.difference | number:'1.2-2' }})
                </span>
              </div>
            </div>
          } @else {
            <p class="text-xs text-zinc-500 text-center py-10 font-medium">Configure parameters and click Generate Report.</p>
          }
        }

        <!-- 3. CASH FLOW -->
        @if (activeTab() === 'cf') {
          @if (store.cashFlow(); as cfList) {
            <div class="space-y-6">
              <div class="border-b border-zinc-900 pb-3">
                <h3 class="text-base font-bold text-white uppercase tracking-wider">Cash Flow Statement</h3>
              </div>

              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="bg-zinc-900/60 border-b border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px] font-semibold">
                    <th class="p-4">Period</th>
                    <th class="p-4 text-right">Cash Inflows (+)</th>
                    <th class="p-4 text-right">Cash Outflows (-)</th>
                    <th class="p-4 text-right">Net Change</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-900">
                  @for (cf of cfList; track cf.period) {
                    <tr class="hover:bg-zinc-900/35 transition-colors">
                      <td class="p-4 font-mono font-bold text-zinc-300">{{ cf.period }}</td>
                      <td class="p-4 text-right font-mono text-emerald-400 font-semibold">+{{ cf.inflows | number:'1.2-2' }}</td>
                      <td class="p-4 text-right font-mono text-red-400 font-semibold">-{{ cf.outflows | number:'1.2-2' }}</td>
                      <td class="p-4 text-right font-mono font-bold" [class.text-emerald-400]="cf.netChange >= 0" [class.text-red-400]="cf.netChange < 0">
                        {{ cf.netChange | number:'1.2-2' }}
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="4" class="p-10 text-center text-zinc-500 font-medium">
                        No bank account movements found in this period.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="text-xs text-zinc-500 text-center py-10 font-medium">Configure date parameters and click Generate Report.</p>
          }
        }
      </div>
    </div>
  `,
})
export class ReportsComponent implements OnInit {
  readonly store = inject(AccountingStore);

  activeTab = signal<string>('pl');
  startDate = '2026-01-01';
  endDate = '2026-12-31';
  currency = 'EGP';
  asOfDate = '2026-12-31';

  readonly tabs = [
    { id: 'pl', label: 'Profit & Loss' },
    { id: 'bs', label: 'Balance Sheet' },
    { id: 'cf', label: 'Cash Flow' },
  ];

  ngOnInit() {
    // defaults
    const year = new Date().getFullYear();
    this.startDate = `${year}-01-01`;
    this.endDate = `${year}-12-31`;
    this.asOfDate = `${year}-12-31`;
    // Auto-load the active report so data is visible immediately
    this.runReport();
  }

  runReport() {
    const tab = this.activeTab();
    if (tab === 'pl') {
      this.store.loadProfitAndLoss({
        startDate: this.startDate,
        endDate: this.endDate,
        currency: this.currency
      });
    } else if (tab === 'bs') {
      this.store.loadBalanceSheet({
        asOfDate: this.asOfDate
      });
    } else if (tab === 'cf') {
      this.store.loadCashFlow({
        startDate: this.startDate,
        endDate: this.endDate
      });
    }
  }
}
