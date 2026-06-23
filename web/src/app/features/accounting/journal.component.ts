import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingStore } from '../../store/accounting.store';
import { JournalEntry } from '../../core/services/accounting-api.service';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-journal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-8 max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white">General Journal Ledger</h1>
          <p class="text-zinc-400 text-sm mt-1">Review ledger transactions and write manual journal entries.</p>
        </div>
        <button
          (click)="openCreateModal()"
          class="px-5 py-2.5 bg-white text-zinc-900 hover:bg-zinc-100 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
          </svg>
          New Manual Entry
        </button>
      </div>

      <!-- Main Ledger Table -->
      <div class="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-zinc-900/60 border-b border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px] font-semibold">
                <th class="p-4 w-8"></th>
                <th class="p-4">Date</th>
                <th class="p-4">Type</th>
                <th class="p-4">Reference</th>
                <th class="p-4">Description</th>
                <th class="p-4 text-right">Debit (EUR)</th>
                <th class="p-4 text-right">Credit (EUR)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-900">
              @for (entry of store.journalEntries(); track entry.id) {
                <!-- Header Row -->
                <tr 
                  (click)="toggleExpand(entry.id)"
                  class="hover:bg-zinc-900/35 transition-colors cursor-pointer"
                >
                  <td class="p-4 text-center text-zinc-500">
                    {{ isExpanded(entry.id) ? '▼' : '▶' }}
                  </td>
                  <td class="p-4 text-zinc-300 font-medium">{{ entry.date | date:'dd MMM yyyy' }}</td>
                  <td class="p-4">
                    <span [class]="getTypeClass(entry.type)" class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border">
                      {{ entry.type }}
                    </span>
                  </td>
                  <td class="p-4 text-zinc-400 font-mono font-semibold">{{ entry.reference || '—' }}</td>
                  <td class="p-4 text-zinc-100 font-semibold">{{ entry.description || 'No description' }}</td>
                  <td class="p-4 text-right font-mono font-bold text-zinc-300">
                    {{ getEntryTotalDebit(entry) | currency:'EGP':'symbol':'1.2-2' }}
                  </td>
                  <td class="p-4 text-right font-mono font-bold text-zinc-300">
                    {{ getEntryTotalCredit(entry) | currency:'EGP':'symbol':'1.2-2' }}
                  </td>
                </tr>

                <!-- Expanded Details (Lines) -->
                @if (isExpanded(entry.id)) {
                  <tr class="bg-zinc-900/15">
                    <td colspan="7" class="p-4">
                      <div class="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/70 p-3 space-y-2">
                        <p class="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Transaction Lines</p>
                        <div class="grid grid-cols-12 gap-2 text-[10px] font-bold text-zinc-500 border-b border-zinc-900 pb-1 px-2 uppercase tracking-wide">
                          <div class="col-span-5">Account</div>
                          <div class="col-span-2 text-right">Debit</div>
                          <div class="col-span-2 text-right">Credit</div>
                          <div class="col-span-1 text-center">Currency</div>
                          <div class="col-span-2 text-right">Amount (EGP)</div>
                        </div>
                        @for (line of entry.lines; track line.id) {
                          <div class="grid grid-cols-12 gap-2 py-1.5 px-2 text-xs items-center border-b border-zinc-900/40 last:border-b-0 hover:bg-zinc-900/20 rounded">
                            <div class="col-span-5 flex flex-col">
                              <span class="text-white font-medium">{{ line.account?.name }}</span>
                              <span class="text-zinc-500 font-mono text-[9px]">{{ line.account?.code }}</span>
                            </div>
                            <div class="col-span-2 text-right font-mono text-zinc-300">
                              {{ line.debit > 0 ? (line.debit | number:'1.2-2') : '—' }}
                            </div>
                            <div class="col-span-2 text-right font-mono text-zinc-300">
                              {{ line.credit > 0 ? (line.credit | number:'1.2-2') : '—' }}
                            </div>
                            <div class="col-span-1 text-center font-mono text-zinc-500">
                              {{ line.currency }}
                            </div>
                            <div class="col-span-2 text-right font-mono font-bold text-zinc-300">
                              {{ line.amountBase | currency:'EGP':'symbol':'1.2-2' }}
                            </div>
                          </div>
                        }
                        @if (entry.attachment) {
                          <div class="flex items-center gap-2 mt-3 pt-2.5 border-t border-zinc-900 text-xs">
                            <span class="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Attachment:</span>
                            <a 
                              [href]="apiService.getPublicImageUrl(entry.attachment)" 
                              target="_blank" 
                              class="text-blue-400 hover:text-blue-300 font-medium hover:underline flex items-center gap-1.5"
                            >
                              📎 View Attachment Document
                            </a>
                          </div>
                        }
                      </div>
                    </td>
                  </tr>
                }
              } @empty {
                <tr>
                  <td colspan="7" class="p-10 text-center text-zinc-500 font-medium">
                    No ledger entries found.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Create Manual Journal Entry Modal -->
      @if (isCreateModalOpen()) {
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-black border border-zinc-800 rounded-xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <!-- Modal Header -->
            <div class="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950 shrink-0">
              <h3 class="font-bold text-white text-base">📝 Record Manual Entry</h3>
              <button (click)="isCreateModalOpen.set(false)" class="text-zinc-500 hover:text-white text-lg font-bold transition-colors cursor-pointer focus:outline-none">&times;</button>
            </div>
            
            <!-- Modal Body -->
            <div class="p-6 space-y-4 overflow-y-auto flex-1">
              <!-- General Info -->
              <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-zinc-400">Date</label>
                  <input 
                    type="date" 
                    [(ngModel)]="newEntry.date" 
                    class="w-full bg-zinc-950 border border-zinc-850 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-700"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-zinc-400">Reference / Document #</label>
                  <input 
                    type="text" 
                    [(ngModel)]="newEntry.reference" 
                    class="w-full bg-zinc-950 border border-zinc-850 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-700 placeholder-zinc-750"
                    placeholder="e.g. JV-2026-001"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-zinc-400">Description</label>
                  <input 
                    type="text" 
                    [(ngModel)]="newEntry.description" 
                    class="w-full bg-zinc-950 border border-zinc-850 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-700 placeholder-zinc-750"
                    placeholder="e.g. Adjust office supplies expense"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-zinc-400">File Attachment (Optional)</label>
                  <div class="flex items-center gap-2 mt-1">
                    <input 
                      type="file" 
                      (change)="onFileSelected($event)" 
                      class="hidden" 
                      #fileInput
                    />
                    <button 
                      type="button"
                      (click)="fileInput.click()"
                      class="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-xs rounded text-white font-medium cursor-pointer"
                    >
                      📎 Attach File
                    </button>
                    @if (isUploading()) {
                      <span class="text-[10px] text-zinc-500">Uploading...</span>
                    } @else if (attachmentName()) {
                      <span class="text-[10px] text-zinc-400 font-mono truncate max-w-[120px]" [title]="attachmentName()">{{ attachmentName() }}</span>
                    }
                  </div>
                </div>
              </div>

              <!-- Lines Header -->
              <div class="border-t border-zinc-900 pt-4">
                <div class="flex items-center justify-between mb-3">
                  <h4 class="text-xs font-bold text-zinc-300 uppercase tracking-wider">Transaction Lines</h4>
                  <button 
                    (click)="addNewLine()"
                    class="px-2.5 py-1 bg-zinc-900 text-zinc-300 border border-zinc-800 hover:text-white hover:border-zinc-700 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    + Add Row
                  </button>
                </div>

                <!-- Validation Alerts -->
                @if (validationError()) {
                  <div class="p-3 bg-red-950/40 border border-red-800/40 rounded text-red-400 text-xs mb-3 font-semibold">
                    ⚠️ {{ validationError() }}
                  </div>
                }

                <!-- Lines Forms -->
                <div class="space-y-2.5">
                  @for (line of newEntry.lines; track $index; let idx = $index) {
                    <div class="grid grid-cols-12 gap-3 items-center bg-zinc-950 border border-zinc-900 p-2.5 rounded-lg">
                      <!-- Account selection -->
                      <div class="col-span-4 space-y-1">
                        <select 
                          [(ngModel)]="line.accountId" 
                          class="w-full bg-zinc-950 border border-zinc-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-700"
                        >
                          <option [ngValue]="0">Select Account...</option>
                          @for (acc of store.accounts(); track acc.id) {
                            <option [ngValue]="acc.id">{{ acc.code }} - {{ acc.name }}</option>
                          }
                        </select>
                      </div>

                      <!-- Debit -->
                      <div class="col-span-2 space-y-1">
                        <input 
                          type="number" 
                          [(ngModel)]="line.debit" 
                          (input)="onAmountInput(idx, 'debit')"
                          placeholder="Debit"
                          class="w-full bg-zinc-950 border border-zinc-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-700 text-right"
                        />
                      </div>

                      <!-- Credit -->
                      <div class="col-span-2 space-y-1">
                        <input 
                          type="number" 
                          [(ngModel)]="line.credit" 
                          (input)="onAmountInput(idx, 'credit')"
                          placeholder="Credit"
                          class="w-full bg-zinc-950 border border-zinc-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-700 text-right"
                        />
                      </div>

                      <!-- Currency -->
                      <div class="col-span-1.5 space-y-1">
                        <select 
                          [(ngModel)]="line.currency" 
                          class="w-full bg-zinc-950 border border-zinc-850 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-700 font-bold"
                        >
                          <option value="EUR">EUR</option>
                          <option value="USD">USD</option>
                          <option value="EGP">EGP</option>
                        </select>
                      </div>

                      <!-- Ex. Rate -->
                      <div class="col-span-1.5 space-y-1">
                        <input 
                          type="number" 
                          [(ngModel)]="line.exchangeRate" 
                          placeholder="Rate"
                          class="w-full bg-zinc-950 border border-zinc-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-700 text-right font-mono"
                        />
                      </div>

                      <!-- Delete -->
                      <div class="col-span-1 text-center">
                        <button 
                          (click)="removeLine(idx)"
                          class="text-zinc-600 hover:text-red-400 font-bold text-sm cursor-pointer transition-colors p-1"
                          title="Delete line"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="px-6 py-4 border-t border-zinc-800 bg-zinc-950 flex justify-between items-center shrink-0">
              <!-- Totals Ticker -->
              <div class="flex gap-4 text-xs font-mono text-zinc-400">
                <div>Total Debit: <span class="text-white font-bold">{{ calculatedTotals().debit | number:'1.2-2' }}</span></div>
                <div>Total Credit: <span class="text-white font-bold">{{ calculatedTotals().credit | number:'1.2-2' }}</span></div>
                <div [class.text-emerald-400]="calculatedTotals().difference === 0" [class.text-red-400]="calculatedTotals().difference !== 0">
                  Diff: {{ calculatedTotals().difference | number:'1.2-2' }}
                </div>
              </div>

              <div class="flex gap-3">
                <button 
                  (click)="isCreateModalOpen.set(false)" 
                  class="px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-white rounded text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  (click)="submitManualEntry()" 
                  [disabled]="calculatedTotals().difference !== 0 || newEntry.lines.length < 2"
                  class="px-4 py-2 bg-white hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-white text-zinc-900 rounded font-semibold text-xs transition-colors cursor-pointer"
                >
                  Post Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class JournalComponent implements OnInit {
  readonly store = inject(AccountingStore);
  readonly apiService = inject(ApiService);

  expandedEntries = signal<Record<number, boolean>>({});
  isCreateModalOpen = signal(false);
  isUploading = signal(false);
  attachmentName = signal('');

  newEntry = {
    date: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
    type: 'manual',
    attachment: '' as string | undefined,
    lines: [] as Array<{
      accountId: number;
      debit?: number;
      credit?: number;
      currency: string;
      exchangeRate?: number;
    }>
  };

  ngOnInit() {
    this.store.loadJournalEntries();
    this.store.loadAccounts();
  }

  toggleExpand(id: number) {
    this.expandedEntries.update(map => ({
      ...map,
      [id]: !map[id]
    }));
  }

  isExpanded(id: number): boolean {
    return !!this.expandedEntries()[id];
  }

  getTypeClass(type: string): string {
    switch (type.toLowerCase()) {
      case 'manual':  return 'bg-zinc-850 text-zinc-300 border-zinc-700';
      case 'po':      return 'bg-blue-950/35 text-blue-400 border-blue-900/40';
      case 'invoice': return 'bg-emerald-950/35 text-emerald-400 border-emerald-900/40';
      case 'payment': return 'bg-purple-950/35 text-purple-400 border-purple-900/40';
      default:        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  }

  getEntryTotalDebit(entry: JournalEntry): number {
    return entry.lines.reduce((sum, line) => sum + (line.debit > 0 ? Number(line.debit) : 0), 0);
  }

  getEntryTotalCredit(entry: JournalEntry): number {
    return entry.lines.reduce((sum, line) => sum + (line.credit > 0 ? Number(line.credit) : 0), 0);
  }

  openCreateModal() {
    this.attachmentName.set('');
    this.newEntry = {
      date: new Date().toISOString().split('T')[0],
      reference: '',
      description: '',
      type: 'manual',
      attachment: undefined,
      lines: [
        { accountId: 0, debit: undefined, credit: undefined, currency: 'EGP', exchangeRate: 1 },
        { accountId: 0, debit: undefined, credit: undefined, currency: 'EGP', exchangeRate: 1 }
      ]
    };
    this.isCreateModalOpen.set(true);
  }

  onFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    this.isUploading.set(true);
    this.apiService.uploadFile(file).subscribe({
      next: (res) => {
        this.newEntry.attachment = res.path;
        this.attachmentName.set(res.name);
        this.isUploading.set(false);
      },
      error: () => {
        alert('File upload failed.');
        this.isUploading.set(false);
      }
    });
  }

  addNewLine() {
    this.newEntry.lines.push({
      accountId: 0,
      debit: undefined,
      credit: undefined,
      currency: 'EGP',
      exchangeRate: 1
    });
  }

  removeLine(idx: number) {
    this.newEntry.lines.splice(idx, 1);
  }

  onAmountInput(idx: number, type: 'debit' | 'credit') {
    const line = this.newEntry.lines[idx];
    if (type === 'debit' && line.debit !== undefined && line.debit > 0) {
      line.credit = undefined;
    } else if (type === 'credit' && line.credit !== undefined && line.credit > 0) {
      line.debit = undefined;
    }
  }

  calculatedTotals() {
    let debit = 0;
    let credit = 0;
    for (const l of this.newEntry.lines) {
      const rate = l.exchangeRate || 1;
      const deb = l.debit || 0;
      const cred = l.credit || 0;
      debit += deb * rate;
      credit += cred * rate;
    }
    return {
      debit,
      credit,
      difference: Number(Math.abs(debit - credit).toFixed(2))
    };
  }

  validationError() {
    const lines = this.newEntry.lines;
    if (lines.length < 2) return 'A journal entry must have at least 2 lines.';
    
    let hasEmptyAccount = false;
    let hasLineWithoutAmount = false;
    for (const l of lines) {
      if (!l.accountId || Number(l.accountId) === 0) hasEmptyAccount = true;
      if ((l.debit === undefined || l.debit <= 0) && (l.credit === undefined || l.credit <= 0)) {
        hasLineWithoutAmount = true;
      }
    }

    if (hasEmptyAccount) return 'All lines must specify an account.';
    if (hasLineWithoutAmount) return 'All lines must specify either a debit or credit amount greater than 0.';
    
    const totals = this.calculatedTotals();
    if (totals.difference > 0.02) {
      return `Total Debits and Credits must balance in EUR. Current difference is ${totals.difference} EUR.`;
    }

    return null;
  }

  submitManualEntry() {
    if (this.validationError()) return;

    // Build lines to match API
    const linesDto = this.newEntry.lines.map(l => ({
      accountId: Number(l.accountId),
      debit: l.debit || 0,
      credit: l.credit || 0,
      currency: l.currency,
      exchangeRate: l.exchangeRate || 1
    }));

    const dto = {
      date: this.newEntry.date,
      reference: this.newEntry.reference || undefined,
      description: this.newEntry.description || undefined,
      type: 'manual',
      attachment: this.newEntry.attachment || undefined,
      lines: linesDto
    };

    this.store.createManualJournalEntry({
      dto,
      onSuccess: () => {
        this.isCreateModalOpen.set(false);
      }
    });
  }
}
