import { JournalEntry, JournalEntryType } from './entities/journal-entry.entity';
import { JournalLine } from './entities/journal-line.entity';
import { Invoice, InvoiceStatus } from '../invoices/entities/invoice.entity';
import { Payment } from '../payments/entities/payment.entity';
import { AccountingAccount } from './entities/accounting-account.entity';

export type ReadinessSeverity = 'blocker' | 'warning';
export interface ReadinessFinding {
  code: string;
  severity: ReadinessSeverity;
  subjectType: 'journal' | 'invoice' | 'payment' | 'account' | 'system';
  subjectId?: number;
  detail: string;
  proposedAction: string;
}
export interface ReadinessReport {
  scope: 'local-kora-test';
  reportType: 'phase2m-diagnostic-not-release-approval';
  generatedAt: string;
  counts: { invoices: number; payments: number; journals: number; journalLines: number; accounts: number };
  findings: ReadinessFinding[];
  blockerCount: number;
  warningCount: number;
  readyForProduction: false;
}
export type ReadinessInput = {
  invoices: Array<Pick<Invoice, 'id' | 'number' | 'type' | 'status' | 'currency' | 'total'>>;
  payments: Array<Pick<Payment, 'id' | 'invoiceId' | 'currency' | 'amount'>>;
  journals: Array<Pick<JournalEntry,
    'id' | 'invoiceId' | 'type' | 'postingStatus' | 'sourceEventKey' | 'reversalOfId'> & {
      lines: Array<Pick<JournalLine, 'id' | 'accountId' | 'debit' | 'credit' | 'currency' | 'amountBase' | 'exchangeRate'>>;
    }>;
  accounts: Array<Pick<AccountingAccount, 'id' | 'code' | 'currency' | 'isActive'>>;
};

export function auditPhase2M(input: ReadinessInput, generatedAt: string): ReadinessReport {
  const findings: ReadinessFinding[] = [];
  const add = (
    code: string, severity: ReadinessSeverity, subjectType: ReadinessFinding['subjectType'],
    subjectId: number | undefined, detail: string, proposedAction: string,
  ) => findings.push({
    code, severity, subjectType, ...(subjectId === undefined ? {} : { subjectId }),
    detail, proposedAction,
  });
  const invoices = new Map(input.invoices.map(x => [x.id, x]));
  const accounts = new Map(input.accounts.map(x => [x.id, x]));
  const journals = new Map(input.journals.map(x => [x.id, x]));
  const keys = new Map<string, number>();
  const reversals = new Map<number, number[]>();
  const paymentKeys = new Map<number, number[]>();

  for (const j of input.journals) {
    if (j.sourceEventKey) {
      const prior = keys.get(j.sourceEventKey);
      if (prior !== undefined) {
        add('DUPLICATE_SOURCE_EVENT', 'blocker', 'journal', j.id,
          `Source event key also appears on journal #${prior}`,
          'Investigate duplicate posting history before any ledger migration');
      } else keys.set(j.sourceEventKey, j.id);
      const match = /^supplier-payment:(\d+):posted:v1$/.exec(j.sourceEventKey);
      if (match) {
        const id = Number(match[1]);
        paymentKeys.set(id, [...(paymentKeys.get(id) || []), j.id]);
      }
    }
    if (j.reversalOfId != null) {
      reversals.set(j.reversalOfId, [...(reversals.get(j.reversalOfId) || []), j.id]);
      if (!journals.has(j.reversalOfId)) {
        add('ORPHANED_REVERSAL', 'blocker', 'journal', j.id,
          'Reversal references a journal that is not present',
          'Locate the original and verify its transaction history');
      }
    }
    if (j.invoiceId != null && !invoices.has(j.invoiceId)) {
      add('ORPHANED_JOURNAL_INVOICE', 'blocker', 'journal', j.id,
        'Journal references a missing invoice',
        'Investigate relationship and document an approved correction');
    }
    if (j.postingStatus === 'posted' || j.postingStatus === 'reversed') {
      let debit = 0, credit = 0;
      if (!j.lines.length) {
        add('EMPTY_POSTED_JOURNAL', 'blocker', 'journal', j.id,
          'Posted/reversed journal has no lines', 'Reconstruct and verify source evidence');
      }
      for (const l of j.lines) {
        const d = Number(l.debit) * 100, c = Number(l.credit) * 100;
        if (!Number.isSafeInteger(Math.round(d)) || !Number.isSafeInteger(Math.round(c)) ||
            Math.abs(d - Math.round(d)) > 0.00001 || Math.abs(c - Math.round(c)) > 0.00001 ||
            d < 0 || c < 0 || (d > 0) === (c > 0)) {
          add('INVALID_JOURNAL_LINE', 'blocker', 'journal', j.id,
            `Line #${l.id} has invalid debit/credit amounts`, 'Review original transaction and journal posting');
        }
        debit += Math.round(d); credit += Math.round(c);
        if (!accounts.has(l.accountId)) add('MISSING_ACCOUNT', 'blocker', 'journal', j.id,
          `Line #${l.id} references missing account #${l.accountId}`, 'Restore verified chart-of-accounts linkage');
        if (l.currency !== 'EGP') add('MANUAL_FX_REVIEW', 'warning', 'journal', j.id,
          `Line #${l.id} is ${l.currency}; no automatic rate validation`,
          'Obtain original manually entered rate and external valuation evidence');
        if (!Number.isFinite(Number(l.amountBase))) add('INVALID_BASE_AMOUNT', 'blocker', 'journal', j.id,
          `Line #${l.id} has invalid recorded base amount`, 'Investigate source ledger');
      }
      if (debit !== credit) add('UNBALANCED_JOURNAL', 'blocker', 'journal', j.id,
        `Debits ${debit} cents do not equal credits ${credit} cents`,
        'Investigate and prepare approved correcting journal, never edit posted history');
    }
  }
  for (const j of input.journals) {
    if (j.postingStatus === 'reversed') {
      const reverse = (reversals.get(j.id) || []).map(id => journals.get(id)!);
      if (reverse.length !== 1 || reverse[0].postingStatus !== 'posted') {
        add('BROKEN_REVERSAL_CHAIN', 'blocker', 'journal', j.id,
          'Reversed journal lacks exactly one posted reversal',
          'Reconcile reversal history with the source payment');
      }
    }
    if (j.reversalOfId != null) {
      const original = journals.get(j.reversalOfId);
      if (original && (original.postingStatus !== 'reversed' || j.postingStatus !== 'posted')) {
        add('INCONSISTENT_REVERSAL_STATUS', 'blocker', 'journal', j.id,
          'Reversal status does not agree with original',
          'Review both journal statuses and approval trail');
      }
    }
  }
  for (const inv of input.invoices) {
    const booking = input.journals.filter(j =>
      j.invoiceId === inv.id && j.type === JournalEntryType.INVOICE &&
      ['posted', 'reversed'].includes(j.postingStatus));
    if (inv.status !== InvoiceStatus.DRAFT && inv.status !== InvoiceStatus.CANCELLED &&
        booking.length !== 1) {
      add('INVOICE_BOOKING_COUNT', 'blocker', 'invoice', inv.id,
        `Issued invoice ${inv.number} has ${booking.length} booked journals`,
        'Compare invoice to posted ledger and resolve through approved migration plan');
    }
    if (inv.currency !== 'EGP') add('FOREIGN_CURRENCY_INVOICE', 'warning', 'invoice', inv.id,
      `Invoice ${inv.number} is ${inv.currency}`,
      'Validate original manual currency rate and settlement history');
  }
  for (const p of input.payments) {
    if (p.invoiceId != null && !invoices.has(p.invoiceId)) {
      add('ORPHANED_PAYMENT_INVOICE', 'blocker', 'payment', p.id,
        'Payment references a missing invoice', 'Investigate source payment and invoice mapping');
    }
    if (p.currency !== 'EGP') add('FOREIGN_CURRENCY_PAYMENT', 'warning', 'payment', p.id,
      `Payment recorded in ${p.currency}`, 'Review original manually entered conversion rate');
    const linked = paymentKeys.get(p.id) || [];
    if (linked.length > 1) add('DUPLICATE_SUPPLIER_PAYMENT_POSTING', 'blocker', 'payment', p.id,
      `Supplier payment is linked to ${linked.length} controlled posting journals`,
      'Investigate exact source-event link before correcting history');
    // Unlinked legacy rows can be standalone: warning, not automatically
    // classified as an invalid payment.
    if (linked.length === 0 && p.invoiceId != null &&
        invoices.get(p.invoiceId)?.type === 'incoming') {
      add('LEGACY_SUPPLIER_PAYMENT_UNVERIFIED', 'warning', 'payment', p.id,
        'Incoming invoice payment has no controlled source-event journal link',
        'Reconcile its legacy references and bank evidence manually');
    }
  }
  findings.sort((a, b) => a.code.localeCompare(b.code) ||
    a.subjectType.localeCompare(b.subjectType) || (a.subjectId || 0) - (b.subjectId || 0));
  return {
    scope: 'local-kora-test',
    reportType: 'phase2m-diagnostic-not-release-approval',
    generatedAt,
    counts: {
      invoices: input.invoices.length, payments: input.payments.length,
      journals: input.journals.length, journalLines: input.journals.reduce((n, j) => n + j.lines.length, 0),
      accounts: input.accounts.length,
    },
    findings, blockerCount: findings.filter(f => f.severity === 'blocker').length,
    warningCount: findings.filter(f => f.severity === 'warning').length,
    readyForProduction: false,
  };
}
