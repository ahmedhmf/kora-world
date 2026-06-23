import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingStore } from '../../store/accounting.store';
import { JournalEntry } from '../../core/services/accounting-api.service';
import { ApiService } from '../../core/services/api.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-journal',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './journal.component.html',
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
