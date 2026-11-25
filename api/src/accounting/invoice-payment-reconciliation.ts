import { Invoice } from '../invoices/entities/invoice.entity';
import { Payment } from '../payments/entities/payment.entity';
import { JournalEntry, JournalEntryType } from './entities/journal-entry.entity';

export type ReconciliationIssue =
  | 'missing_invoice_booking'
  | 'multiple_invoice_bookings'
  | 'synthetic_payment_journal'
  | 'unlinked_payment_record'
  | 'unmatched_payment_journal'
  | 'duplicate_payment_reference'
  | 'multiple_payment_journals'
  | 'orphaned_reversal'
  | 'duplicate_reversal'
  | 'inconsistent_reversal_status'
  | 'paid_without_payment'
  | 'amount_mismatch'
  | 'currency_requires_manual_review';

export interface InvoiceReconciliationRow {
  invoiceId: number;
  invoiceNumber: string;
  currency: string;
  status: string;
  invoiceTotal: number;
  invoiceJournalIds: number[];
  paymentIds: number[];
  paymentJournalIds: number[];
  reversalJournalIds: number[];
  issues: ReconciliationIssue[];
  clean: boolean;
}

/**
 * Conservative structural audit, NOT an accounting repair or definitive FX
 * reconciliation. A matching reference alone is not proof of real cash movement.
 */
export function reconcileInvoicePayments(
  invoice: Pick<Invoice, 'id' | 'number' | 'currency' | 'status' | 'total'>,
  payments: Array<Pick<Payment, 'id' | 'invoiceId' | 'reference' | 'amount' | 'currency'>>,
  journals: Array<Pick<JournalEntry,
    'id' | 'invoiceId' | 'reference' | 'type' | 'sourceEventKey' |
    'reversalOfId' | 'postingStatus'>>,
): InvoiceReconciliationRow {
  const issues = new Set<ReconciliationIssue>();
  const booking = journals.filter(j => j.type === JournalEntryType.INVOICE);
  const paymentJournals = journals.filter(j => j.type === JournalEntryType.PAYMENT);
  const originals = paymentJournals.filter(j => !j.reversalOfId);
  const reversals = paymentJournals.filter(j => !!j.reversalOfId);
  const hasBookingRequirement = invoice.status !== 'draft' && invoice.status !== 'cancelled';
  if (hasBookingRequirement && booking.length === 0) issues.add('missing_invoice_booking');
  if (booking.length > 1) issues.add('multiple_invoice_bookings');
  if (invoice.currency !== 'EGP' || payments.some(p => p.currency !== invoice.currency)) {
    issues.add('currency_requires_manual_review');
  }
  const used = new Set<number>();
  const referenceCounts = new Map<string, number>();
  for (const p of payments) {
    if (p.reference) referenceCounts.set(p.reference, (referenceCounts.get(p.reference) || 0) + 1);
    const key = `supplier-payment:${p.id}:posted:v1`;
    const matches = originals.filter(j =>
      j.sourceEventKey === key ||
      (!j.sourceEventKey && !!p.reference && j.reference === p.reference &&
        j.reference !== `${invoice.number}-PAY`));
    if (matches.length === 0) issues.add('unlinked_payment_record');
    if (matches.length > 1) issues.add('multiple_payment_journals');
    for (const match of matches) {
      if (used.has(match.id)) issues.add('multiple_payment_journals');
      used.add(match.id);
    }
  }
  if ([...referenceCounts.values()].some(count => count > 1)) issues.add('duplicate_payment_reference');
  for (const journal of originals) {
    if (journal.reference === `${invoice.number}-PAY` &&
        !journal.sourceEventKey) {
      issues.add('synthetic_payment_journal');
    }
    if (!used.has(journal.id)) issues.add('unmatched_payment_journal');
  }
  for (const original of originals) {
    const linked = reversals.filter(j => j.reversalOfId === original.id);
    if ((original.postingStatus === 'reversed' && linked.length !== 1) ||
        (original.postingStatus === 'posted' && linked.length > 0) ||
        (original.postingStatus !== 'posted' && original.postingStatus !== 'reversed' &&
          payments.some(p => original.sourceEventKey === `supplier-payment:${p.id}:posted:v1`))) {
      issues.add('inconsistent_reversal_status');
    }
  }
  for (const reversal of reversals) {
    const original = originals.find(j => j.id === reversal.reversalOfId);
    if (!original) {
      issues.add('orphaned_reversal');
      continue;
    }
    if (reversals.filter(j => j.reversalOfId === original.id).length > 1) {
      issues.add('duplicate_reversal');
    }
    if (original.postingStatus !== 'reversed' || reversal.postingStatus !== 'posted') {
      issues.add('inconsistent_reversal_status');
    }
  }
  if (invoice.status === 'paid' && payments.length === 0) issues.add('paid_without_payment');
  // Exact total comparisons are only valid for EGP and unambiguous amounts.
  if (invoice.currency === 'EGP' &&
      payments.every(p => p.currency === 'EGP') &&
      !issues.has('unlinked_payment_record') &&
      !issues.has('multiple_payment_journals') &&
      !issues.has('unmatched_payment_journal') &&
      !issues.has('synthetic_payment_journal') &&
      !issues.has('inconsistent_reversal_status')) {
    const active = payments.filter(p => {
      const j = originals.find(j => j.sourceEventKey === `supplier-payment:${p.id}:posted:v1` ||
        (!j.sourceEventKey && p.reference && j.reference === p.reference));
      return j && j.postingStatus === 'posted';
    });
    const paidCents = active.reduce((sum, p) => sum + Math.round(Number(p.amount) * 100), 0);
    const totalCents = Math.round(Number(invoice.total) * 100);
    if (paidCents > totalCents || (invoice.status === 'paid' && paidCents !== totalCents)) {
      issues.add('amount_mismatch');
    }
  }
  const sorted = [...issues].sort();
  return {
    invoiceId: invoice.id, invoiceNumber: invoice.number,
    currency: invoice.currency, status: invoice.status,
    invoiceTotal: Number(invoice.total),
    invoiceJournalIds: booking.map(j => j.id),
    paymentIds: payments.map(p => p.id),
    paymentJournalIds: originals.map(j => j.id),
    reversalJournalIds: reversals.map(j => j.id),
    issues: sorted, clean: sorted.length === 0,
  };
}
