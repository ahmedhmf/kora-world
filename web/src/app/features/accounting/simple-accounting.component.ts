import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AccountingApiService, AccountingAccount } from '../../core/services/accounting-api.service';
import { AuthService } from '../../core/services/auth.service';

type Kind = 'expense' | 'income' | 'transfer';

@Component({
  selector: 'app-simple-accounting',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './simple-accounting.component.html',
})
export class SimpleAccountingComponent implements OnInit {
  private readonly api = inject(AccountingApiService);
  readonly auth = inject(AuthService);
  readonly accounts = signal<AccountingAccount[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly kind = signal<Kind>('expense');
  readonly form = {
    date: new Date().toISOString().slice(0, 10),
    description: '',
    amount: null as number | null,
    cashAccountId: 0,
    categoryAccountId: 0,
    destinationAccountId: 0,
  };
  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');
  readonly leafAccounts = computed(() => {
    const accounts = this.accounts();
    const parentIds = new Set(accounts.map(a => a.parentId).filter((id): id is number => id != null));
    return accounts.filter(a => a.isActive && a.currency.toUpperCase() === 'EGP' && !parentIds.has(a.id));
  });
  readonly moneyAccounts = computed(() => this.leafAccounts().filter(a =>
    a.type === 'asset' && a.code.startsWith('11'),
  ));
  readonly categories = computed(() => this.leafAccounts().filter(a =>
    a.type === (this.kind() === 'expense' ? 'expense' : 'revenue'),
  ));

  ngOnInit(): void {
    this.loading.set(true);
    this.api.getAccounts().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: accounts => this.accounts.set(accounts),
      error: err => this.error.set(this.message(err)),
    });
  }

  choose(kind: Kind): void {
    this.kind.set(kind);
    this.form.categoryAccountId = 0;
    this.form.destinationAccountId = 0;
    this.error.set('');
    this.success.set('');
  }

  private cents(): number | null {
    const amount = Number(this.form.amount);
    if (this.form.amount == null || !Number.isFinite(amount) || amount <= 0) return null;
    const value = Math.round(amount * 100);
    if (!Number.isSafeInteger(value) || Math.abs(value - amount * 100) > 0.000001) return null;
    return value;
  }

  validation(): string | null {
    if (!this.form.description.trim()) return 'What was this transaction for? Add a description.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.form.date) ||
      Number.isNaN(Date.parse(this.form.date)) ||
      new Date(this.form.date).toISOString().slice(0, 10) !== this.form.date) {
      return 'Select a valid date.';
    }
    if (this.cents() === null) return 'Enter a positive EGP amount with at most two decimals.';
    if (!this.moneyAccounts().some(a => a.id === Number(this.form.cashAccountId))) {
      return 'Choose an active cash/bank EGP account.';
    }
    const other = this.kind() === 'transfer' ? Number(this.form.destinationAccountId) : Number(this.form.categoryAccountId);
    const options = this.kind() === 'transfer' ? this.moneyAccounts() : this.categories();
    if (!options.some(a => a.id === other)) {
      return this.kind() === 'transfer' ? 'Choose the receiving cash/bank account.' : 'Choose a category.';
    }
    if (other === Number(this.form.cashAccountId)) return 'Choose two different accounts.';
    return null;
  }

  save(): void {
    if (this.busy()) return;
    const problem = this.validation();
    if (problem) {
      this.error.set(problem);
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    this.api.createSimpleTransaction({
      kind: this.kind(),
      date: this.form.date,
      description: this.form.description.trim(),
      amountCents: this.cents()!,
      cashAccountId: Number(this.form.cashAccountId),
      ...(this.kind() === 'transfer'
        ? { destinationAccountId: Number(this.form.destinationAccountId) }
        : { categoryAccountId: Number(this.form.categoryAccountId) }),
    }).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: result => {
        this.success.set(result.status === 'posted'
          ? `Recorded and posted. Transaction #${result.journalId}.`
          : `Sent to Admin for approval. Transaction #${result.journalId}.`);
        this.form.description = '';
        this.form.amount = null;
      },
      error: err => this.error.set(this.message(err)),
    });
  }

  private message(err: any): string {
    const m = err?.error?.message ?? err?.message ?? 'Unable to record the transaction.';
    return Array.isArray(m) ? m.join(', ') : String(m);
  }
}
