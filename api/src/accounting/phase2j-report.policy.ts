import { AccountingAccount, AccountType } from './entities/accounting-account.entity';
import { JournalEntry, JournalEntryType } from './entities/journal-entry.entity';
import { Invoice, InvoiceType } from '../invoices/entities/invoice.entity';
import { Payment } from '../payments/entities/payment.entity';

export type AuditIssue = { code: string; invoiceId?: number; journalId?: number; detail: string };
export interface SubledgerRow {
  invoiceId: number; number: string; counterparty: string; currency: string; status: string;
  total: number; paid: number | null; reversed: number | null; outstanding: number | null;
  reviewRequired: boolean; issues: string[];
}
export interface Subledger { invoices: SubledgerRow[]; outstandingEgp: number; reviewCount: number }
export interface StatementRow { code: string; name: string; amount: number }
export interface Phase2JResult {
  currency: 'EGP'; startDate: string; endDate: string; asOfDate: string;
  ap: Subledger; ar: Subledger;
  profitLoss: { revenue: StatementRow[]; expenses: StatementRow[]; grossProfit: number; netProfit: number };
  balanceSheet: { assets: StatementRow[]; liabilities: StatementRow[]; equity: StatementRow[];
    totalAssets: number; totalLiabilities: number; totalEquity: number; difference: number; isBalanced: boolean };
  cashFlow: { period: string; inflows: number; outflows: number; netChange: number }[];
  issues: AuditIssue[];
  journalCount: number; needsReview: boolean;
}

export interface ReportJournal extends Pick<JournalEntry,
  'id' | 'invoiceId' | 'date' | 'type' | 'sourceEventKey' | 'postingStatus' | 'reversalOfId'> {
  lines: Array<{ accountId: number; debit: number; credit: number; amountBase: number; currency: string }>;
}
export type ReportInvoice = Pick<Invoice,
  'id' | 'number' | 'date' | 'type' | 'currency' | 'status' | 'total' | 'supplierId' | 'customerName'> & {
    supplier?: { name: string } | null;
  };
export type ReportPayment = Pick<Payment,
  'id' | 'invoiceId' | 'date' | 'amount' | 'currency' | 'reference' | 'exchangeRate'>;

const cents = (n: number) => Math.round(Number(n) * 100);
const money = (n: number) => Number((n / 100).toFixed(2));
const dateKey = (d: Date | string) => typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);

export function buildPhase2JReport(input: {
  startDate: string; endDate: string; asOfDate: string;
  invoices: ReportInvoice[]; payments: ReportPayment[];
  journals: ReportJournal[]; accounts: AccountingAccount[];
}): Phase2JResult {
  const { startDate, endDate, asOfDate, invoices, payments, journals, accounts } = input;
  const issues: AuditIssue[] = [];
  const add = (code: string, detail: string, invoiceId?: number, journalId?: number) =>
    issues.push({ code, detail, ...(invoiceId !== undefined ? { invoiceId } : {}),
      ...(journalId !== undefined ? { journalId } : {}) });
  const accountById = new Map(accounts.map(a => [a.id, a]));
  const journalById = new Map(journals.map(j => [j.id, j]));
  const invoiceIds = new Set(invoices.map(i => i.id));

  // A reversed original still has financial effect until its separate equal and
  // opposite posted reversal journal is included. Never just drop it by status.
  for (const j of journals) {
    if (j.reversalOfId) {
      const original = journalById.get(j.reversalOfId);
      if (!original || original.postingStatus !== 'reversed' || j.postingStatus !== 'posted') {
        add('reversal_history_inconsistent', 'Reversal/original pair requires manual review', j.invoiceId || undefined, j.id);
      }
    } else if (j.postingStatus === 'reversed' &&
      journals.filter(other => other.reversalOfId === j.id && other.postingStatus === 'posted').length !== 1) {
      add('reversal_history_inconsistent', 'Reversed original has no single posted reversal', j.invoiceId || undefined, j.id);
    }
    if (j.invoiceId != null && !invoiceIds.has(j.invoiceId)) {
      add('orphaned_journal_invoice', 'Journal references a missing invoice', j.invoiceId, j.id);
    }
    if (j.postingStatus !== 'posted' && j.postingStatus !== 'reversed') continue;
    let debits = 0, credits = 0;
    for (const line of j.lines) {
      if (!accountById.has(line.accountId)) add('missing_account', 'Journal line account missing', j.invoiceId || undefined, j.id);
      if (!Number.isFinite(Number(line.amountBase)) || !Number.isFinite(Number(line.debit)) ||
          !Number.isFinite(Number(line.credit))) {
        add('invalid_journal_amount', 'Journal has non-finite monetary values', j.invoiceId || undefined, j.id);
      }
      if (line.currency !== 'EGP') {
        add('manual_fx_review', 'Non-EGP journal line: recorded EGP base amount must be verified manually', j.invoiceId || undefined, j.id);
      }
      debits += cents(line.debit);
      credits += cents(line.credit);
    }
    if (debits !== credits) add('unbalanced_journal', 'Journal debits and credits do not balance', j.invoiceId || undefined, j.id);
  }

  const makeLedger = (type: InvoiceType): Subledger => {
    const rows: SubledgerRow[] = [];
    for (const inv of invoices.filter(i => i.type === type && i.status !== 'draft' && i.status !== 'cancelled' && dateKey(i.date) <= asOfDate)) {
      const issueCodes = new Set<string>();
      const warn = (code: string, message: string) => {
        issueCodes.add(code);
        add(code, message, inv.id);
      };
      const linked = journals.filter(j => j.invoiceId === inv.id);
      const booking = linked.filter(j => j.type === JournalEntryType.INVOICE);
      const paymentsFor = payments.filter(p => p.invoiceId === inv.id && dateKey(p.date) <= asOfDate);
      const originals = linked.filter(j => j.type === JournalEntryType.PAYMENT && !j.reversalOfId && dateKey(j.date) <= asOfDate);
      const allReversals = linked.filter(j => j.type === JournalEntryType.PAYMENT && !!j.reversalOfId);
      const reversals = allReversals.filter(j => dateKey(j.date) <= asOfDate);
      if (issues.some(issue => issue.invoiceId === inv.id &&
          ['reversal_history_inconsistent', 'unbalanced_journal', 'invalid_journal_amount',
           'missing_account', 'manual_fx_review'].includes(issue.code))) {
        warn('invoice_journal_review', 'Invoice has a journal integrity warning; verify before calculating balances');
      }
      if (booking.length !== 1 || booking[0].postingStatus !== 'posted') {
        warn('invoice_booking_ambiguous', 'Invoice has no single posted booking journal');
      }
      if (inv.currency !== 'EGP' || paymentsFor.some(p => p.currency !== 'EGP')) {
        warn('manual_fx_review', 'Foreign-currency invoice/payment requires manual valuation; no rate inferred');
      }
      let paidCents = 0, reversedCents = 0;
      const linkedJournalIds = new Set<number>();
      for (const p of paymentsFor) {
        const expected = type === InvoiceType.INCOMING ? `supplier-payment:${p.id}:posted:v1` : `customer-payment:${p.id}:posted:v1`;
        const matches = originals.filter(j => j.sourceEventKey === expected);
        if (matches.length !== 1 || linkedJournalIds.has(matches[0]?.id)) {
          warn('payment_link_ambiguous', `Payment #${p.id} has no unique controlled journal; legacy history requires review`);
          continue;
        }
        const original = matches[0];
        linkedJournalIds.add(original.id);
        const reverse = allReversals.filter(j => j.reversalOfId === original.id);
        // Effective as-of state uses posting dates, not merely the original
        // journal's CURRENT reversed flag. A later reversal cannot erase a
        // payment from an earlier balance sheet date.
        const effectiveReversals = reverse.filter(j => dateKey(j.date) <= asOfDate);
        if (dateKey(original.date) > asOfDate) {
          warn('payment_date_mismatch', `Payment #${p.id} predates its journal posting date`);
        } else if (effectiveReversals.length === 0 &&
                   (original.postingStatus === 'posted' ||
                    (original.postingStatus === 'reversed' && reverse.length === 1 &&
                     dateKey(reverse[0].date) > asOfDate && reverse[0].postingStatus === 'posted'))) {
          paidCents += cents(p.amount);
        } else if (effectiveReversals.length === 1 &&
                   original.postingStatus === 'reversed' &&
                   effectiveReversals[0].postingStatus === 'posted') {
          reversedCents += cents(p.amount);
        } else {
          warn('payment_reversal_ambiguous', `Payment #${p.id} has inconsistent reversal history`);
        }
        if (!Number.isSafeInteger(paidCents) || !Number.isSafeInteger(reversedCents)) {
          warn('amount_overflow', 'Payment total exceeds supported integer cents range');
        }
      }
      if (originals.some(j => !linkedJournalIds.has(j.id)) ||
          reversals.some(j => !linkedJournalIds.has(j.reversalOfId!))) {
        warn('unmatched_payment_journal', 'Payment journal has no unique matching payment row');
      }
      const totalCents = cents(inv.total);
      if (!Number.isSafeInteger(totalCents) || totalCents < 0 ||
          paidCents > totalCents) {
        warn('invoice_balance_mismatch', 'Invoice total and verified settlements disagree');
      }
      const reviewRequired = issueCodes.size > 0;
      const counterparty = type === InvoiceType.INCOMING
        ? inv.supplier?.name || inv.customerName || `Supplier #${inv.supplierId || 'unknown'}`
        : inv.customerName || 'Unknown customer';
      rows.push({
        invoiceId: inv.id, number: inv.number, counterparty,
        currency: inv.currency, status: inv.status, total: Number(inv.total),
        paid: reviewRequired ? null : money(paidCents),
        reversed: reviewRequired ? null : money(reversedCents),
        outstanding: reviewRequired ? null : money(totalCents - paidCents),
        reviewRequired, issues: [...issueCodes].sort(),
      });
    }
    return {
      invoices: rows, outstandingEgp: money(rows.filter(r => !r.reviewRequired)
        .reduce((sum, r) => sum + cents(r.outstanding!), 0)),
      reviewCount: rows.filter(r => r.reviewRequired).length,
    };
  };

  // Base EGP uses amounts ALREADY persisted on journal lines, never exchange
  // rate lookup. Non-EGP source journal lines are flagged for manual review.
  const active = journals.filter(j =>
    (j.postingStatus === 'posted' || j.postingStatus === 'reversed') &&
    dateKey(j.date) <= asOfDate);
  const totals = new Map<number, number>();
  const revenues = new Map<number, number>();
  const expenses = new Map<number, number>();
  const cash = new Map<string, { inflows: number; outflows: number }>();
  for (const journal of active) {
    const periodDate = dateKey(journal.date);
    const inPeriod = periodDate >= startDate && periodDate <= endDate;
    for (const line of journal.lines) {
      const account = accountById.get(line.accountId);
      if (!account) continue;
      const value = cents(line.amountBase);
      if (!Number.isSafeInteger(value)) continue;
      totals.set(account.id, (totals.get(account.id) || 0) + value);
      if (inPeriod && account.type === AccountType.REVENUE) {
        revenues.set(account.id, (revenues.get(account.id) || 0) - value);
      }
      if (inPeriod && account.type === AccountType.EXPENSE) {
        expenses.set(account.id, (expenses.get(account.id) || 0) + value);
      }
      if (inPeriod && account.type === AccountType.ASSET && account.code.startsWith('11')) {
        const period = periodDate.slice(0, 7);
        const prior = cash.get(period) || { inflows: 0, outflows: 0 };
        const signed = cents(line.debit) - cents(line.credit);
        if (signed >= 0) prior.inflows += signed;
        else prior.outflows -= signed;
        cash.set(period, prior);
      }
    }
  }
  const statement = (values: Map<number, number>): StatementRow[] =>
    [...values.entries()].map(([id, value]) => ({
      code: accountById.get(id)!.code,
      name: accountById.get(id)!.name,
      amount: money(value),
    })).sort((a, b) => a.code.localeCompare(b.code));

  const revenue = statement(revenues);
  const expense = statement(expenses);
  const totalRevenue = revenue.reduce((s, r) => s + cents(r.amount), 0);
  const totalExpense = expense.reduce((s, r) => s + cents(r.amount), 0);
  const cogs = expense.filter(r => r.code.startsWith('51')).reduce((s, r) => s + cents(r.amount), 0);

  const balanceType = (type: AccountType) => statement(new Map(
    accounts.filter(a => a.type === type).map(a => [
      a.id, (totals.get(a.id) || 0) * (type === AccountType.ASSET ? 1 : -1),
    ]),
  )).filter(row => row.amount !== 0);
  const assets = balanceType(AccountType.ASSET);
  const liabilities = balanceType(AccountType.LIABILITY);
  const equity = balanceType(AccountType.EQUITY);
  const totalAssets = assets.reduce((sum, r) => sum + cents(r.amount), 0);
  const totalLiabilities = liabilities.reduce((sum, r) => sum + cents(r.amount), 0);
  const totalEquity = equity.reduce((sum, r) => sum + cents(r.amount), 0);
  // Retained earnings/current-year income may not yet be closed into equity:
  // surface the difference, do not fabricate an equity journal or silently
  // label an incomplete chart of accounts as a balanced statement.
  const difference = totalAssets - totalLiabilities - totalEquity;
  if (Math.abs(difference) > 2) add('balance_sheet_difference',
    'Assets do not equal liabilities plus posted equity; verify retained earnings and journal history');
  const rows = [...cash].map(([period, val]) => ({
    period, inflows: money(val.inflows), outflows: money(val.outflows),
    netChange: money(val.inflows - val.outflows),
  })).sort((a, b) => a.period.localeCompare(b.period));

  const ap = makeLedger(InvoiceType.INCOMING);
  const ar = makeLedger(InvoiceType.OUTGOING);
  if (payments.some(p => p.invoiceId == null || !invoiceIds.has(p.invoiceId))) {
    add('unassigned_payment', 'One or more payments have no valid invoice; investigate independently');
  }
  return {
    currency: 'EGP', startDate, endDate, asOfDate, ap, ar,
    profitLoss: {
      revenue, expenses: expense,
      grossProfit: money(totalRevenue - cogs),
      netProfit: money(totalRevenue - totalExpense),
    },
    balanceSheet: {
      assets, liabilities, equity,
      totalAssets: money(totalAssets),
      totalLiabilities: money(totalLiabilities),
      totalEquity: money(totalEquity),
      difference: money(difference), isBalanced: Math.abs(difference) <= 2,
    },
    cashFlow: rows, issues, journalCount: journals.length, needsReview: issues.length > 0,
  };
}
