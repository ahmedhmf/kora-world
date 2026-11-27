import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingAccount, AccountingApiService, Phase2LView } from '../../core/services/accounting-api.service';
import { AuthService } from '../../core/services/auth.service';

type BankImportRow = { date: string; amountCents: number; reference: string; description: string };
type OpeningRow = { accountId: number | null; debitCents: number; creditCents: number };

@Component({
  selector: 'app-phase2l-bank',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './phase2l-bank.component.html',
})
export class Phase2LBankComponent implements OnInit {
  private readonly api = inject(AccountingApiService);
  readonly auth = inject(AuthService);
  readonly allowed = computed(() => {
    const h = window.location.hostname;
    return (h === 'localhost' || h === '127.0.0.1') &&
      this.auth.currentUser()?.role === 'admin';
  });
  readonly accounts = signal<AccountingAccount[]>([]);
  readonly view = signal<Phase2LView | null>(null);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly busy = signal(false);
  selectedAccountId: number | null = null;
  statementKey = '';
  openingBalance = '';
  closingBalance = '';
  readonly importedRows = signal<BankImportRow[]>([]);
  openingDate = new Date().toISOString().slice(0, 10);
  openingReference = '';
  openingRows: OpeningRow[] = [
    { accountId: null, debitCents: 0, creditCents: 0 },
    { accountId: null, debitCents: 0, creditCents: 0 },
  ];
  private requested = 0;

  readonly bankAccounts = computed(() => this.accounts()
    .filter(a => a.type === 'asset' && a.code.startsWith('11') && a.currency === 'EGP' && a.isActive &&
      !this.accounts().some(child => child.parentId === a.id)));
  readonly openingAccounts = computed(() => this.accounts()
    .filter(a => ['asset', 'liability', 'equity'].includes(a.type) && a.currency === 'EGP' && a.isActive &&
      !this.accounts().some(child => child.parentId === a.id)));
  get debitSum(): number { return this.openingRows.reduce((s, r) => s + (Number(r.debitCents) || 0), 0); }
  get creditSum(): number { return this.openingRows.reduce((s, r) => s + (Number(r.creditCents) || 0), 0); }
  get previewNet(): number { return this.importedRows().reduce((s, row) => s + row.amountCents, 0); }
  get unmatchedCount(): number { return this.view()?.rows.filter(r => r.matchedJournalLineId === null).length ?? 0; }

  ngOnInit(): void {
    if (!this.allowed()) return;
    this.api.getAccounts().subscribe({
      next: accounts => { this.accounts.set(accounts); },
      error: () => this.error.set('Cannot load accounting accounts'),
    });
  }

  reload() {
    if (!this.allowed() || !this.selectedAccountId || this.busy()) return;
    const token = ++this.requested;
    this.busy.set(true); this.error.set(null);
    this.api.getBankReconciliation(Number(this.selectedAccountId)).subscribe({
      next: data => {
        if (token !== this.requested) return;
        this.view.set(data); this.busy.set(false);
      },
      error: err => {
        if (token !== this.requested) return;
        this.busy.set(false); this.error.set(this.describeError(err));
      },
    });
  }

  addOpeningRow() {
    if (this.openingRows.length < 100) {
      this.openingRows.push({ accountId: null, debitCents: 0, creditCents: 0 });
    }
  }
  removeOpeningRow(index: number) {
    if (this.openingRows.length > 2) this.openingRows.splice(index, 1);
  }
  postOpening() {
    if (!this.allowed() || this.busy() || this.debitSum <= 0 ||
        this.debitSum !== this.creditSum) return;
    if (!confirm('Post this verified opening-balance journal? Existing account history is not overwritten.')) return;
    this.busy.set(true); this.error.set(null);
    this.api.postOpeningBalances({
      date: this.openingDate, reference: this.openingReference.trim(),
      lines: this.openingRows.map(r => ({
        accountId: Number(r.accountId), debitCents: Number(r.debitCents),
        creditCents: Number(r.creditCents),
      })),
    }).subscribe({
      next: result => {
        this.busy.set(false);
        this.success.set(`Opening journal #${result.journalId}${result.replayed ? ' (verified replay)' : ''} posted. No other balances were changed.`);
      },
      error: err => { this.busy.set(false); this.error.set(this.describeError(err)); },
    });
  }

  private parseCsv(text: string): string[][] {
    // RFC4180-ish quoted-field reader: comma-delimited UTF-8, CRLF, escaped quotes.
    const records: string[][] = [];
    let fields: string[] = [], field = '', quoted = false;
    const source = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < source.length; i++) {
      const char = source[i];
      if (char === '"') {
        if (quoted && source[i + 1] === '"') { field += '"'; i++; }
        else if (quoted || field === '') quoted = !quoted;
        else throw new Error('Unexpected quote in CSV');
      } else if (char === ',' && !quoted) { fields.push(field); field = ''; }
      else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && source[i + 1] === '\n') i++;
        fields.push(field);
        if (fields.some(v => v.trim() !== '')) records.push(fields);
        fields = []; field = '';
      } else field += char;
    }
    if (quoted) throw new Error('CSV has an unclosed quoted field');
    fields.push(field);
    if (fields.some(v => v.trim() !== '')) records.push(fields);
    return records;
  }
  onFile(event: Event) {
    const element = event.target as HTMLInputElement;
    const file = element.files?.[0];
    element.value = '';
    this.importedRows.set([]);
    if (!file) return;
    if (file.size > 100_000) {
      this.error.set('CSV too large; maximum 100 KB and 500 rows'); return;
    }
    file.text().then(text => {
      const csv = this.parseCsv(text);
      const header = csv.shift()?.map(value => value.trim().toLowerCase());
      if (header?.join(',') !== 'date,amount,reference,description') {
        throw new Error('CSV columns must be exactly date,amount,reference,description');
      }
      if (csv.length < 1 || csv.length > 500) throw new Error('CSV must contain 1–500 rows');
      const rows = csv.map((columns, i) => {
        if (columns.length !== 4 || !/^\d{4}-\d{2}-\d{2}$/.test(columns[0].trim())) {
          throw new Error(`Row ${i + 2}: expected ISO date YYYY-MM-DD and 4 columns`);
        }
        const value = columns[1].trim();
        if (!/^-?\d{1,9}\.\d{2}$/.test(value) || value === '0.00' || value === '-0.00') {
          throw new Error(`Row ${i + 2}: signed amount must have exactly two decimals (e.g. -2345.00)`);
        }
        const amountCents = Math.round(Number(value) * 100);
        if (!Number.isSafeInteger(amountCents) || amountCents === 0) throw new Error('Invalid amount');
        return {
          date: columns[0].trim(), amountCents,
          reference: columns[2].trim(), description: columns[3].trim(),
        };
      });
      this.importedRows.set(rows);
      this.error.set(null);
      this.success.set(`Parsed ${rows.length} rows. Review and confirm before importing.`);
    }).catch(err => this.error.set(err instanceof Error ? err.message : 'CSV parsing failed'));
  }

  importStatement() {
    if (!this.allowed() || this.busy() || !this.selectedAccountId || !this.importedRows().length) return;
    if (!confirm(`Import ${this.importedRows().length} statement rows to the selected EGP bank account? This does NOT post payments.`)) return;
    const parseBalance = (v: string): number | null => {
      if (v.trim() === '') return null;
      if (!/^-?\\d{1,9}\\.\\d{2}$/.test(v.trim())) {
        throw new Error('Opening and closing statement balances must be EGP amounts with exactly two decimals');
      }
      const cents = Math.round(Number(v.trim()) * 100);
      if (!Number.isSafeInteger(cents)) throw new Error('Balance exceeds supported EGP range');
      return cents;
    };
    let first: number | null;
    let last: number | null;
    try {
      first = parseBalance(this.openingBalance);
      last = parseBalance(this.closingBalance);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Invalid statement balance');
      return;
    }
    this.busy.set(true); this.error.set(null);
    this.api.importBankStatement({
      accountId: Number(this.selectedAccountId), statementKey: this.statementKey.trim(),
      openingBalanceCents: first,
      closingBalanceCents: last,
      rows: this.importedRows(),
    }).subscribe({
      next: result => {
        this.busy.set(false);
        this.importedRows.set([]);
        this.success.set(`Imported statement #${result.importId} with ${result.rowCount} rows. No journal was created.`);
        this.reload();
      },
      error: err => { this.busy.set(false); this.error.set(this.describeError(err)); },
    });
  }

  candidatesFor(row: Phase2LView['rows'][number]) {
    return this.view()?.candidates.filter(candidate =>
      candidate.amountCents === row.amountCents &&
      String(candidate.date).slice(0, 10) === String(row.date).slice(0, 10)) ?? [];
  }

  match(rowId: number, journalLineId: number) {
    if (!this.allowed() || this.busy()) return;
    const reason = prompt('Explain why this bank row matches this posted journal line:');
    if (!reason?.trim()) return;
    if (!confirm('Confirm one-to-one match? This does not create or change an accounting entry.')) return;
    this.busy.set(true); this.error.set(null);
    this.api.matchBankRow(rowId, journalLineId, reason.trim()).subscribe({
      next: () => { this.busy.set(false); this.success.set('Bank row matched and audited'); this.reload(); },
      error: err => { this.busy.set(false); this.error.set(this.describeError(err)); },
    });
  }

  unmatch(rowId: number) {
    if (!this.allowed() || this.busy()) return;
    const reason = prompt('Explain why this match must be removed:');
    if (!reason?.trim()) return;
    if (!confirm('Unmatch this row? Audit history will remain.')) return;
    this.busy.set(true); this.error.set(null);
    this.api.unmatchBankRow(rowId, reason.trim()).subscribe({
      next: () => { this.busy.set(false); this.success.set('Bank row unmatched; history retained'); this.reload(); },
      error: err => { this.busy.set(false); this.error.set(this.describeError(err)); },
    });
  }

  private describeError(error: { error?: { message?: string | string[] }; status?: number }) {
    const message = error?.error?.message;
    if (Array.isArray(message)) return message.join('; ');
    return message || (error?.status === 403
      ? 'Local kora_test or ACCOUNTING_PHASE2L permission guard refused this operation'
      : 'Request failed. Check the local backend and try again.');
  }
}
