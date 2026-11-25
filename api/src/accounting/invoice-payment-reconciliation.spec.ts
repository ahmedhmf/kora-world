import { JournalEntryType } from './entities/journal-entry.entity';
import { reconcileInvoicePayments } from './invoice-payment-reconciliation';

const invoice = {
  id: 1, number: 'INV-001', status: 'sent', currency: 'EGP', total: 100,
};
const booking = {
  id: 10, invoiceId: 1, type: JournalEntryType.INVOICE,
  reference: 'INV-001', sourceEventKey: null,
  reversalOfId: null, postingStatus: 'posted' as const,
};
const payment = {
  id: 20, invoiceId: 1, reference: 'SUP-PAY-20',
  amount: 40, currency: 'EGP',
};
const original = {
  id: 30, invoiceId: 1, type: JournalEntryType.PAYMENT,
  reference: 'SUP-PAY-20', sourceEventKey: 'supplier-payment:20:posted:v1',
  reversalOfId: null, postingStatus: 'posted' as const,
};
describe('reconcileInvoicePayments: non-destructive audit', () => {
  it('recognizes an unambiguous active settlement', () => {
    const row = reconcileInvoicePayments(invoice, [payment], [booking, original]);
    expect(row.clean).toBe(true);
    expect(row.paymentJournalIds).toEqual([30]);
    expect(row.paymentIds).toEqual([20]);
  });

  it('recognizes a valid reversal without counting it as a second payment', () => {
    const row = reconcileInvoicePayments(invoice, [payment], [
      booking, {...original, postingStatus: 'reversed'},
      {...original, id: 31, sourceEventKey: 'supplier-payment:20:reversal:v1',
        reversalOfId: 30, postingStatus: 'posted'},
    ]);
    expect(row.clean).toBe(true);
    expect(row.reversalJournalIds).toEqual([31]);
  });

  it('flags synthetic PAID journals with no real payment', () => {
    const row = reconcileInvoicePayments({...invoice, status: 'paid'}, [], [
      booking, {...original, reference: 'INV-001-PAY', sourceEventKey: null},
    ]);
    expect(row.issues).toEqual(expect.arrayContaining([
      'synthetic_payment_journal', 'unmatched_payment_journal', 'paid_without_payment',
    ]));
  });

  it('flags duplicate invoice bookings and unmatched payment records', () => {
    const row = reconcileInvoicePayments(invoice, [payment], [
      booking, {...booking, id: 11},
    ]);
    expect(row.issues).toEqual(expect.arrayContaining([
      'multiple_invoice_bookings', 'unlinked_payment_record',
    ]));
  });

  it('flags duplicate matching and ambiguous payment references', () => {
    const row = reconcileInvoicePayments(invoice, [
      payment, {...payment, id: 21},
    ], [booking, {...original, sourceEventKey: null}]);
    expect(row.issues).toEqual(expect.arrayContaining([
      'duplicate_payment_reference', 'multiple_payment_journals',
    ]));
  });

  it('flags orphaned and inconsistent reversal records', () => {
    const row = reconcileInvoicePayments(invoice, [payment], [
      booking, original,
      {...original, id: 31, sourceEventKey: 'supplier-payment:20:reversal:v1',
        reversalOfId: 999, postingStatus: 'posted'},
      {...original, id: 32, sourceEventKey: 'supplier-payment:20:reversal:v1',
        reversalOfId: 30, postingStatus: 'posted'},
    ]);
    expect(row.issues).toEqual(expect.arrayContaining([
      'orphaned_reversal', 'inconsistent_reversal_status',
    ]));
  });

  it('requires manual review of foreign-currency entries and never converts them', () => {
    const row = reconcileInvoicePayments(
      {...invoice, currency: 'EUR'}, [{...payment, currency: 'EUR'}],
      [booking, {...original, sourceEventKey: null}],
    );
    expect(row.issues).toContain('currency_requires_manual_review');
  });

  it('flags PAID invoices with a non-matching actual EGP settlement amount', () => {
    const row = reconcileInvoicePayments(
      {...invoice, status: 'paid'}, [payment], [booking, original],
    );
    expect(row.issues).toContain('amount_mismatch');
  });
});
