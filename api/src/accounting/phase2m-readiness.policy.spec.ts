import { auditPhase2M, ReadinessInput } from './phase2m-readiness.policy';
import { JournalEntryType } from './entities/journal-entry.entity';
import { InvoiceStatus, InvoiceType } from '../invoices/entities/invoice.entity';
import { AccountType } from './entities/accounting-account.entity';

const fixture = (): ReadinessInput => ({
  invoices: [{
    id: 1, number: 'SUP-1', type: InvoiceType.INCOMING,
    status: InvoiceStatus.SENT, currency: 'EGP', total: 200,
  }],
  payments: [],
  journals: [{
    id: 9, invoiceId: 1, type: JournalEntryType.INVOICE,
    postingStatus: 'posted', sourceEventKey: 'supplier-invoice:1:booked:v1', reversalOfId: null,
    lines: [
      { id: 20, accountId: 51, debit: 200, credit: 0, currency: 'EGP', amountBase: 200, exchangeRate: 1 },
      { id: 21, accountId: 21, debit: 0, credit: 200, currency: 'EGP', amountBase: -200, exchangeRate: 1 },
    ],
  }],
  accounts: [
    { id: 51, code: '5100', currency: 'EGP', isActive: true },
    { id: 21, code: '2100', currency: 'EGP', isActive: true },
  ],
});

describe('Phase 2M historical audit', () => {
  const run = (input: ReadinessInput) => auditPhase2M(input, '2026-11-27T00:00:00.000Z');

  it('does not grant production approval even for structurally consistent history', () => {
    const result = run(fixture());
    expect(result.blockerCount).toBe(0);
    expect(result.readyForProduction).toBe(false);
    expect(result.reportType).toBe('phase2m-diagnostic-not-release-approval');
    expect(result.counts).toEqual({ invoices: 1, payments: 0, journals: 1, journalLines: 2, accounts: 2 });
  });

  it('detects duplicate source event keys and duplicate issued invoice booking', () => {
    const data = fixture();
    data.journals.push({ ...data.journals[0], id: 10 });
    const result = run(data);
    expect(result.findings.map(f => f.code)).toEqual(expect.arrayContaining([
      'DUPLICATE_SOURCE_EVENT', 'INVOICE_BOOKING_COUNT',
    ]));
    expect(result.blockerCount).toBeGreaterThan(0);
  });

  it('detects unbalanced posted journals and does not silently repair them', () => {
    const data = fixture();
    data.journals[0].lines[1].credit = 199;
    const result = run(data);
    expect(result.findings.some(x => x.code === 'UNBALANCED_JOURNAL')).toBe(true);
    expect(data.journals[0].lines[1].credit).toBe(199);
  });

  it('detects missing invoices and missing accounts', () => {
    const data = fixture();
    data.journals[0].invoiceId = 999;
    data.journals[0].lines[1].accountId = 999;
    const result = run(data);
    expect(result.findings.map(x => x.code)).toEqual(expect.arrayContaining([
      'ORPHANED_JOURNAL_INVOICE', 'MISSING_ACCOUNT', 'INVOICE_BOOKING_COUNT',
    ]));
  });

  it('detects missing reversal history', () => {
    const data = fixture();
    data.journals[0].postingStatus = 'reversed';
    expect(run(data).findings.some(x => x.code === 'BROKEN_REVERSAL_CHAIN')).toBe(true);
  });

  it('flags legacy payments without controlled link but does not assume they are invalid', () => {
    const data = fixture();
    data.payments.push({ id: 4, invoiceId: 1, currency: 'EGP', amount: 25 });
    const result = run(data);
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'LEGACY_SUPPLIER_PAYMENT_UNVERIFIED',
        severity: 'warning',
        subjectType: 'payment', subjectId: 4,
      }),
    ]));
  });

  it('flags manually entered foreign currency without converting it', () => {
    const data = fixture();
    data.invoices[0].currency = 'EUR';
    data.journals[0].lines[0].currency = 'EUR';
    const result = run(data);
    expect(result.findings.map(x => x.code)).toEqual(expect.arrayContaining([
      'FOREIGN_CURRENCY_INVOICE', 'MANUAL_FX_REVIEW',
    ]));
    expect(data.journals[0].lines[0].amountBase).toBe(200);
  });
});
