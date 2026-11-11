import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AccountingStore } from '../../store/accounting.store';
import {
  AccountingApiService,
  JournalEntry,
} from '../../core/services/accounting-api.service';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';

type JournalFilter = 'all' | 'draft' | 'pending_approval' | 'posted' | 'reversed';
type EntryLine = { accountId: number; debit: number | null; credit: number | null };

@Component({
  selector: 'app-journal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './journal.component.html',
})
export class JournalComponent implements OnInit {
  readonly store = inject(AccountingStore);
  readonly accounting = inject(AccountingApiService);
  readonly auth = inject(AuthService);
  readonly apiService = inject(ApiService);

  readonly entries = signal<JournalEntry[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly filter = signal<JournalFilter>('all');
  readonly expandedEntries = signal<Record<number, boolean>>({});
  readonly isCreateModalOpen = signal(false);
  readonly reversingId = signal<number | null>(null);
  reversalReason = '';

  newEntry: { date: string; reference: string; description: string; lines: EntryLine[] } =
    this.emptyEntry();

  readonly currentUserId = computed(() => Number(this.auth.currentUser()?.id ?? this.auth.currentUser()?.sub ?? 0));
  readonly isAccountant = computed(() =>
    ['admin', 'accountant'].includes(String(this.auth.currentUser()?.role ?? '').toLowerCase()),
  );
  readonly filteredEntries = computed(() => {
    const selected = this.filter();
    return this.entries().filter(entry =>
      selected === 'all' || (entry.postingStatus ?? 'posted') === selected,
    );
  });
  readonly pendingCount = computed(() =>
    this.entries().filter(entry => entry.postingStatus === 'pending_approval').length,
  );
  readonly accountsForEntry = computed(() => {
    const accounts = this.store.accounts();
    const parents = new Set(accounts.map(a => a.parentId).filter((id): id is number => id != null));
    return accounts.filter(a => a.isActive && a.currency.toUpperCase() === 'EGP' && !parents.has(a.id));
  });

  ngOnInit(): void {
    this.store.loadAccounts();
    this.refresh();
  }

  private emptyEntry() {
    return {
      date: new Date().toISOString().slice(0, 10),
      reference: '',
      description: '',
      lines: [
        { accountId: 0, debit: null, credit: null },
        { accountId: 0, debit: null, credit: null },
      ] as EntryLine[],
    };
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set('');
    this.accounting.getWorkflowJournalEntries()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: entries => this.entries.set(entries),
        error: err => this.error.set(this.message(err)),
      });
  }

  setFilter(value: JournalFilter): void {
    this.filter.set(value);
  }

  toggleExpand(id: number): void {
    this.expandedEntries.update(state => ({ ...state, [id]: !state[id] }));
  }

  isExpanded(id: number): boolean {
    return !!this.expandedEntries()[id];
  }

  canSubmit(entry: JournalEntry): boolean {
    return entry.type === 'manual' && entry.postingStatus === 'draft' &&
      this.currentUserId() > 0 && entry.createdById === this.currentUserId();
  }

  canApprove(entry: JournalEntry): boolean {
    return this.isAccountant() && entry.type === 'manual' &&
      entry.postingStatus === 'pending_approval' &&
      entry.createdById != null && entry.createdById !== this.currentUserId() &&
      entry.submittedById !== this.currentUserId();
  }

  canReverse(entry: JournalEntry): boolean {
    return this.isAccountant() && entry.type === 'manual' &&
      entry.postingStatus === 'posted' && !entry.reversalOfId;
  }

  totalDebit(entry: JournalEntry): number {
    // Use EGP base amounts rather than incorrectly summing unrelated currencies.
    return entry.lines.reduce((sum, line) => sum + Math.max(0, Number(line.amountBase)), 0);
  }

  totalCredit(entry: JournalEntry): number {
    return entry.lines.reduce((sum, line) => sum + Math.max(0, -Number(line.amountBase)), 0);
  }

  getStatus(entry: JournalEntry): string {
    return entry.postingStatus ?? 'posted';
  }

  getStatusClass(entry: JournalEntry): string {
    switch (this.getStatus(entry)) {
      case 'draft': return 'text-zinc-300 border-zinc-700 bg-zinc-900';
      case 'pending_approval': return 'text-amber-300 border-amber-900 bg-amber-950/40';
      case 'posted': return 'text-emerald-300 border-emerald-900 bg-emerald-950/40';
      case 'reversed': return 'text-purple-300 border-purple-900 bg-purple-950/40';
      default: return 'text-zinc-300 border-zinc-700 bg-zinc-900';
    }
  }

  openCreateModal(): void {
    this.newEntry = this.emptyEntry();
    this.error.set('');
    this.isCreateModalOpen.set(true);
  }

  addNewLine(): void {
    this.newEntry.lines.push({ accountId: 0, debit: null, credit: null });
  }

  removeLine(index: number): void {
    if (this.newEntry.lines.length > 2) this.newEntry.lines.splice(index, 1);
  }

  onAmountInput(index: number, type: 'debit' | 'credit'): void {
    const line = this.newEntry.lines[index];
    if (type === 'debit' && Number(line.debit) > 0) line.credit = null;
    if (type === 'credit' && Number(line.credit) > 0) line.debit = null;
  }

  private toCents(value: number | null): number | null {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n) || n < 0) return null;
    const scaled = Math.round(n * 100);
    if (!Number.isSafeInteger(scaled) || Math.abs(n * 100 - scaled) > 0.000001) return null;
    return scaled;
  }

  calculatedTotals() {
    let debitCents = 0;
    let creditCents = 0;
    for (const line of this.newEntry.lines) {
      debitCents += this.toCents(line.debit) ?? 0;
      creditCents += this.toCents(line.credit) ?? 0;
    }
    return { debit: debitCents / 100, credit: creditCents / 100, difference: (debitCents - creditCents) / 100 };
  }

  validationError(): string | null {
    if (!this.newEntry.description.trim()) return 'Description is required.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.newEntry.date) ||
      Number.isNaN(Date.parse(this.newEntry.date)) ||
      new Date(this.newEntry.date).toISOString().slice(0, 10) !== this.newEntry.date) {
      return 'Enter a valid date.';
    }
    if (this.newEntry.reference.length > 100) return 'Reference must be 100 characters or fewer.';
    if (this.newEntry.lines.length < 2) return 'At least two lines are required.';
    const allowed = new Set(this.accountsForEntry().map(account => account.id));
    if (!allowed.size) return 'No eligible EGP accounts are available. Create or activate a leaf EGP account in the Chart of Accounts.';
    let debit = 0;
    let credit = 0;
    for (const [index, line] of this.newEntry.lines.entries()) {
      const row = index + 1;
      if (!allowed.has(Number(line.accountId))) return `Line ${row}: select an active leaf EGP account.`;
      const d = this.toCents(line.debit);
      const c = this.toCents(line.credit);
      if (d === null || c === null) return `Line ${row}: enter nonnegative amounts with at most two decimal places.`;
      if (d === 0 && c === 0) return `Line ${row}: enter an amount in Debit or Credit (leave the other blank).`;
      if (d > 0 && c > 0) return `Line ${row}: use either Debit or Credit, not both.`;
      debit += d;
      credit += c;
      if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit)) return 'Amount is too large.';
    }
    if (debit !== credit) return 'Debits and credits must balance exactly in EGP.';
    return null;
  }

  createDraft(): void {
    const validation = this.validationError();
    if (validation || this.busy()) {
      if (validation) this.error.set(validation);
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    this.accounting.createManualDraft({
      date: this.newEntry.date,
      reference: this.newEntry.reference.trim() || undefined,
      description: this.newEntry.description.trim(),
      lines: this.newEntry.lines.map(line => ({
        accountId: Number(line.accountId),
        debitCents: this.toCents(line.debit)!,
        creditCents: this.toCents(line.credit)!,
      })),
    }).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => {
        this.isCreateModalOpen.set(false);
        this.success.set('Draft created. Submit it when ready for accountant approval.');
        this.refresh();
      },
      error: err => this.error.set(this.message(err)),
    });
  }

  submit(entry: JournalEntry): void {
    if (!this.canSubmit(entry) || this.busy()) return;
    this.execute(() => this.accounting.submitManualDraft(entry.id),
      'Journal submitted for accountant approval.');
  }

  approve(entry: JournalEntry): void {
    if (!this.canApprove(entry) || this.busy()) return;
    this.execute(() => this.accounting.approveManualJournal(entry.id),
      'Journal approved and posted.');
  }

  startReversal(entry: JournalEntry): void {
    if (!this.canReverse(entry)) return;
    this.reversingId.set(entry.id);
    this.reversalReason = '';
    this.error.set('');
  }

  cancelReversal(): void {
    this.reversingId.set(null);
    this.reversalReason = '';
  }

  confirmReversal(): void {
    const id = this.reversingId();
    if (id == null || this.busy() || !this.reversalReason.trim()) {
      this.error.set('A reversal reason is required.');
      return;
    }
    const entry = this.entries().find(item => item.id === id);
    if (!entry || !this.canReverse(entry)) return;
    this.execute(() => this.accounting.reverseManualJournal(id, this.reversalReason.trim()),
      'Reversal posted. The original entry remains in the audit trail.', () => this.cancelReversal());
  }

  private execute(operation: () => import('rxjs').Observable<JournalEntry>,
    confirmation: string, onSuccess?: () => void): void {
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    operation().pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => {
        onSuccess?.();
        this.success.set(confirmation);
        this.refresh();
      },
      error: err => this.error.set(this.message(err)),
    });
  }

  private message(error: any): string {
    const message = error?.error?.message ?? error?.message ?? 'Request failed.';
    return Array.isArray(message) ? message.join(', ') : String(message);
  }
}
