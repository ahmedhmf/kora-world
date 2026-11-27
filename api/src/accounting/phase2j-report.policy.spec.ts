import { buildPhase2JReport, ReportInvoice, ReportJournal, ReportPayment } from './phase2j-report.policy';
import { AccountType, AccountingAccount } from './entities/accounting-account.entity';
import { InvoiceType } from '../invoices/entities/invoice.entity';
import { JournalEntryType } from './entities/journal-entry.entity';

const a = (id: number, code: string, type: AccountType): AccountingAccount =>
  ({ id, code, type, name: code, currency: 'EGP', isActive: true }) as AccountingAccount;
const accounts = [
  a(1, '5100', AccountType.EXPENSE),
  a(2, '2100', AccountType.LIABILITY),
  a(3, '1102', AccountType.ASSET),
  a(4, '4100', AccountType.REVENUE),
  a(5, '1200', AccountType.ASSET),
];
const invoice: ReportInvoice = {
  id: 7, number: 'SUP-7', type: InvoiceType.INCOMING, status: 'partially_paid' as never,
  currency: 'EGP', date: '2026-11-11', total: 100, supplierId: 9, customerName: null, supplier: { name: 'Supplier A' },
};
const journal = (
  id: number, type: JournalEntryType,
  lines: ReportJournal['lines'], options: Partial<ReportJournal> = {},
): ReportJournal => ({
  id, invoiceId: 7, date: '2026-11-12', type, postingStatus: 'posted',
  sourceEventKey: null, reversalOfId: null, lines, ...options,
});
const line = (accountId: number, debit: number, credit: number) =>
  ({ accountId, debit, credit, currency: 'EGP', amountBase: debit - credit });
const booking = journal(10, JournalEntryType.INVOICE, [line(1, 100, 0), line(2, 0, 100)]);
const pay = journal(11, JournalEntryType.PAYMENT, [line(2, 40, 0), line(3, 0, 40)], {
  sourceEventKey: 'supplier-payment:22:posted:v1',
});
const payment: ReportPayment = {
  id: 22, invoiceId: 7, date: '2026-11-12', amount: 40, currency: 'EGP',
  exchangeRate: 1, reference: 'SUP-PAY-22',
};
const report = (options: Partial<{
  invoices: ReportInvoice[]; payments: ReportPayment[];
  journals: ReportJournal[]; accounts: AccountingAccount[];
}> = {}) => buildPhase2JReport({
  startDate: '2026-01-01', endDate: '2026-12-31', asOfDate: '2026-12-31',
  invoices: [invoice], payments: [payment], journals: [booking, pay], accounts, ...options,
});

describe('Phase 2J report reconciliation', () => {
  it('calculates AP from one verified partial supplier payment', () => {
    const r = report();
    expect(r.ap.reviewCount).toBe(0);
    expect(r.ap.outstandingEgp).toBe(60);
    expect(r.ap.invoices[0]).toEqual(expect.objectContaining({
      paid: 40, reversed: 0, outstanding: 60, reviewRequired: false,
    }));
    expect(r.cashFlow[0]).toEqual({
      period: '2026-11', inflows: 0, outflows: 40, netChange: -40,
    });
  });

  it('counts a reversed original with its opposite journal in statements but no settled AP', () => {
    const reversal = journal(12, JournalEntryType.PAYMENT,
      [line(2, 0, 40), line(3, 40, 0)], {
        sourceEventKey: 'supplier-payment:22:reversal:v1', reversalOfId: 11,
      });
    const r = report({
      journals: [booking, { ...pay, postingStatus: 'reversed' }, reversal],
    });
    expect(r.ap.invoices[0]).toEqual(expect.objectContaining({
      paid: 0, reversed: 40, outstanding: 100, reviewRequired: false,
    }));
    expect(r.cashFlow[0].netChange).toBe(0);
    expect(r.issues.some(x => x.code === 'reversal_history_inconsistent')).toBe(false);
  });

  it('preserves historical outstanding balance before a later reversal date', () => {
    const later = journal(12, JournalEntryType.PAYMENT,
      [line(2, 0, 40), line(3, 40, 0)], {
        date: '2027-01-15',
        sourceEventKey: 'supplier-payment:22:reversal:v1', reversalOfId: 11,
      });
    const r = buildPhase2JReport({
      startDate: '2026-01-01', endDate: '2026-12-31',
      asOfDate: '2026-12-31',
      invoices: [invoice], payments: [payment],
      journals: [booking, { ...pay, postingStatus: 'reversed' }, later], accounts,
    });
    expect(r.ap.invoices[0]).toEqual(expect.objectContaining({
      paid: 40, reversed: 0, outstanding: 60, reviewRequired: false,
    }));
  });

  it('never treats an unlinked legacy payment as verified settlement', () => {
    const r = report({ journals: [booking, { ...pay, sourceEventKey: null }] });
    expect(r.ap.invoices[0].reviewRequired).toBe(true);
    expect(r.ap.invoices[0].outstanding).toBeNull();
    expect(r.ap.reviewCount).toBe(1);
    expect(r.issues.some(x => x.code === 'payment_link_ambiguous')).toBe(true);
  });

  it('flags non-EGP invoices for manual valuation rather than converting', () => {
    const r = report({
      invoices: [{ ...invoice, currency: 'EUR' }],
      payments: [{ ...payment, currency: 'EUR' }],
    });
    expect(r.ap.invoices[0].reviewRequired).toBe(true);
    expect(r.ap.invoices[0].paid).toBeNull();
    expect(r.issues.some(x => x.code === 'manual_fx_review')).toBe(true);
  });

  it('calculates AR and P&L based on persisted journal lines', () => {
    const customer: ReportInvoice = {
      ...invoice, id: 8, number: 'CUS-8', type: InvoiceType.OUTGOING,
      customerName: 'Customer X', supplier: null, supplierId: null,
      status: 'sent' as never,
    };
    const sales = journal(20, JournalEntryType.INVOICE, [
      line(5, 100, 0), line(4, 0, 100),
    ], { invoiceId: 8 });
    const r = report({
      invoices: [invoice, customer], journals: [booking, pay, sales],
    });
    expect(r.ar.invoices[0]).toEqual(expect.objectContaining({
      outstanding: 100, counterparty: 'Customer X', reviewRequired: false,
    }));
    expect(r.profitLoss.netProfit).toBe(0);
    expect(r.profitLoss.grossProfit).toBe(0);
    expect(r.profitLoss.revenue[0].amount).toBe(100);
    expect(r.profitLoss.expenses[0].amount).toBe(100);
  });

  it('rejects verified AP totals when booking journal differs from invoice total', () => {
    const r = report({
      journals: [{ ...booking, lines: [line(1, 90, 0), line(2, 0, 90)] }, pay],
    });
    expect(r.ap.invoices[0].reviewRequired).toBe(true);
    expect(r.ap.invoices[0].outstanding).toBeNull();
    expect(r.issues.some(i => i.code === 'invoice_booking_amount_mismatch')).toBe(true);
  });

  it('flags missing posted reversals and never repairs them', () => {
    const r = report({ journals: [booking, { ...pay, postingStatus: 'reversed' }] });
    expect(r.needsReview).toBe(true);
    expect(r.ap.invoices[0].reviewRequired).toBe(true);
    expect(r.issues.some(x => x.code === 'reversal_history_inconsistent')).toBe(true);
  });

  it('excludes draft journal lines from financial statements', () => {
    const draft = journal(100, JournalEntryType.MANUAL,
      [line(3, 500, 0), line(4, 0, 500)], {
        invoiceId: null, postingStatus: 'draft',
      });
    const r = report({ journals: [booking, pay, draft] });
    expect(r.profitLoss.revenue).toEqual([]);
    expect(r.cashFlow[0].outflows).toBe(40);
  });

  it('shows a single Marketing Money Out as current-year loss without a false balance-sheet warning', () => {
    const marketing = a(6, '5300', AccountType.EXPENSE);
    const moneyOut = journal(30, JournalEntryType.MANUAL, [
      line(6, 2345, 0), line(3, 0, 2345),
    ], { invoiceId: null, date: '2026-11-27' });
    const r = report({
      invoices: [], payments: [], journals: [moneyOut],
      accounts: [...accounts, marketing],
    });
    expect(r.profitLoss.netProfit).toBe(-2345);
    expect(r.balanceSheet.totalAssets).toBe(-2345);
    expect(r.balanceSheet.totalEquity).toBe(0);
    expect(r.balanceSheet.currentYearEarnings).toBe(-2345);
    expect(r.balanceSheet.priorUnclosedEarnings).toBe(0);
    expect(r.balanceSheet.adjustedEquity).toBe(-2345);
    expect(r.balanceSheet.difference).toBe(0);
    expect(r.balanceSheet.isBalanced).toBe(true);
    expect(r.issues.some(x => x.code === 'balance_sheet_difference')).toBe(false);
    expect(r.cashFlow[0].netChange).toBe(-2345);
  });

  it('includes a Money In revenue as positive unclosed earnings', () => {
    const moneyIn = journal(31, JournalEntryType.MANUAL, [
      line(3, 800, 0), line(4, 0, 800),
    ], { invoiceId: null, date: '2026-08-10' });
    const r = report({ invoices: [], payments: [], journals: [moneyIn] });
    expect(r.profitLoss.netProfit).toBe(800);
    expect(r.balanceSheet.totalAssets).toBe(800);
    expect(r.balanceSheet.currentYearEarnings).toBe(800);
    expect(r.balanceSheet.adjustedEquity).toBe(800);
    expect(r.balanceSheet.isBalanced).toBe(true);
    expect(r.issues.some(x => x.code === 'balance_sheet_difference')).toBe(false);
  });

  it('calculates current-year earnings independent of the selected P&L period', () => {
    const priorMonth = journal(32, JournalEntryType.MANUAL, [
      line(3, 600, 0), line(4, 0, 600),
    ], { invoiceId: null, date: '2026-01-20' });
    const r = buildPhase2JReport({
      startDate: '2026-11-01', endDate: '2026-11-30', asOfDate: '2026-12-31',
      invoices: [], payments: [], journals: [priorMonth], accounts,
    });
    expect(r.profitLoss.netProfit).toBe(0);
    expect(r.balanceSheet.currentYearEarnings).toBe(600);
    expect(r.balanceSheet.difference).toBe(0);
    expect(r.balanceSheet.isBalanced).toBe(true);
  });

  it('shows prior-year unclosed earnings separately from current-year earnings', () => {
    const priorYear = journal(33, JournalEntryType.MANUAL, [
      line(3, 400, 0), line(4, 0, 400),
    ], { invoiceId: null, date: '2025-07-10' });
    const currentYear = journal(34, JournalEntryType.MANUAL, [
      line(1, 100, 0), line(3, 0, 100),
    ], { invoiceId: null, date: '2026-03-10' });
    const r = report({ invoices: [], payments: [], journals: [priorYear, currentYear] });
    expect(r.balanceSheet.priorUnclosedEarnings).toBe(400);
    expect(r.balanceSheet.currentYearEarnings).toBe(-100);
    expect(r.balanceSheet.unclosedEarnings).toBe(300);
    expect(r.balanceSheet.adjustedEquity).toBe(300);
    expect(r.balanceSheet.difference).toBe(0);
  });

  it('does not double count nominal accounts after a genuine closing journal', () => {
    const revenue = journal(35, JournalEntryType.MANUAL, [
      line(3, 100, 0), line(4, 0, 100),
    ], { invoiceId: null, date: '2026-06-01' });
    const closing = journal(36, JournalEntryType.MANUAL, [
      line(4, 100, 0), line(6, 0, 100),
    ], { invoiceId: null, date: '2026-12-31' });
    const retained = a(6, '3100', AccountType.EQUITY);
    const r = report({
      invoices: [], payments: [], journals: [revenue, closing],
      accounts: [...accounts, retained],
    });
    expect(r.balanceSheet.currentYearEarnings).toBe(0);
    expect(r.balanceSheet.totalEquity).toBe(100);
    expect(r.balanceSheet.adjustedEquity).toBe(100);
    expect(r.balanceSheet.difference).toBe(0);
  });

  it('still flags a genuinely unbalanced balance sheet after including earnings', () => {
    const unmatched = journal(37, JournalEntryType.MANUAL, [
      line(3, 99, 0),
    ], { invoiceId: null });
    const r = report({ invoices: [], payments: [], journals: [unmatched] });
    expect(r.balanceSheet.isBalanced).toBe(false);
    expect(r.balanceSheet.difference).toBe(99);
    expect(r.issues.some(x => x.code === 'balance_sheet_difference')).toBe(true);
    expect(r.issues.some(x => x.code === 'unbalanced_journal')).toBe(true);
  });
});
