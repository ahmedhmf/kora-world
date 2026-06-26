import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AccountingApiService } from './accounting-api.service';

describe('AccountingApiService', () => {
  let service: AccountingApiService;
  let httpTesting: HttpTestingController;

  const base = 'http://localhost:3000';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AccountingApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AccountingApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should be created', () => expect(service).toBeTruthy());

  // ─── Chart of Accounts ────────────────────────────────────────────────────

  it('getAccounts() → GET /accounting/accounts (no params)', () => {
    service.getAccounts().subscribe();
    httpTesting.expectOne(`${base}/accounting/accounts`).flush([]);
  });

  it('getAccounts({ type }) → GET /accounting/accounts?type=asset', () => {
    service.getAccounts({ type: 'asset' }).subscribe();
    httpTesting.expectOne(`${base}/accounting/accounts?type=asset`).flush([]);
  });

  it('getAccounts({ codes }) → GET /accounting/accounts?codes=…', () => {
    service.getAccounts({ codes: '1000,2000' }).subscribe();
    httpTesting.expectOne(`${base}/accounting/accounts?codes=1000,2000`).flush([]);
  });

  it('getAccounts({ type, codes }) → GET /accounting/accounts?type=asset&codes=…', () => {
    service.getAccounts({ type: 'asset', codes: '1000' }).subscribe();
    httpTesting.expectOne(`${base}/accounting/accounts?type=asset&codes=1000`).flush([]);
  });

  it('getAccountTree() → GET /accounting/accounts/tree', () => {
    service.getAccountTree().subscribe();
    httpTesting.expectOne(`${base}/accounting/accounts/tree`).flush([]);
  });

  it('createAccount() → POST /accounting/accounts', () => {
    service.createAccount({ code: '1001', name: 'Cash' }).subscribe();
    const req = httpTesting.expectOne(`${base}/accounting/accounts`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('updateAccount(1, …) → PUT /accounting/accounts/1', () => {
    service.updateAccount(1, { name: 'Updated Cash' }).subscribe();
    const req = httpTesting.expectOne(`${base}/accounting/accounts/1`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  // ─── Journal Entries ──────────────────────────────────────────────────────

  it('getJournalEntries() → GET /accounting/journal-entries', () => {
    service.getJournalEntries().subscribe();
    httpTesting.expectOne(`${base}/accounting/journal-entries`).flush([]);
  });

  it('createManualJournalEntry() → POST /accounting/journal/manual', () => {
    service.createManualJournalEntry({ lines: [] }).subscribe();
    const req = httpTesting.expectOne(`${base}/accounting/journal/manual`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('getExchangeRate() → GET /accounting/exchange-rates/rate?from=…&to=…&date=…', () => {
    service.getExchangeRate('USD', 'EGP', '2026-01-01').subscribe();
    httpTesting.expectOne(`${base}/accounting/exchange-rates/rate?from=USD&to=EGP&date=2026-01-01`).flush(50.5);
  });

  // ─── Invoices ─────────────────────────────────────────────────────────────

  it('getNextInvoiceNumber() → GET /invoices/next-number', () => {
    service.getNextInvoiceNumber().subscribe();
    httpTesting.expectOne(`${base}/invoices/next-number`).flush({ number: 'INV-2026-0001' });
  });

  it('getInvoices() → GET /invoices', () => {
    service.getInvoices().subscribe();
    httpTesting.expectOne(`${base}/invoices`).flush([]);
  });

  it('getInvoice(3) → GET /invoices/3', () => {
    service.getInvoice(3).subscribe();
    httpTesting.expectOne(`${base}/invoices/3`).flush({});
  });

  it('createInvoice() → POST /invoices', () => {
    service.createInvoice({ type: 'incoming' }).subscribe();
    const req = httpTesting.expectOne(`${base}/invoices`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('updateInvoice(3, …) → PUT /invoices/3', () => {
    service.updateInvoice(3, { status: 'paid' }).subscribe();
    const req = httpTesting.expectOne(`${base}/invoices/3`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('deleteInvoice(3) → DELETE /invoices/3', () => {
    service.deleteInvoice(3).subscribe();
    const req = httpTesting.expectOne(`${base}/invoices/3`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  // ─── Payments ─────────────────────────────────────────────────────────────

  it('getPayments() → GET /payments', () => {
    service.getPayments().subscribe();
    httpTesting.expectOne(`${base}/payments`).flush([]);
  });

  it('createPayment() → POST /payments', () => {
    service.createPayment({ amount: 1000 }).subscribe();
    const req = httpTesting.expectOne(`${base}/payments`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('deletePayment(4) → DELETE /payments/4', () => {
    service.deletePayment(4).subscribe();
    const req = httpTesting.expectOne(`${base}/payments/4`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  // ─── Reports ──────────────────────────────────────────────────────────────

  it('getProfitAndLoss() → GET with startDate/endDate', () => {
    service.getProfitAndLoss('2026-01-01', '2026-12-31').subscribe();
    httpTesting.expectOne(
      `${base}/accounting/reports/profit-loss?startDate=2026-01-01&endDate=2026-12-31`
    ).flush({});
  });

  it('getProfitAndLoss() → GET with optional currency', () => {
    service.getProfitAndLoss('2026-01-01', '2026-12-31', 'USD').subscribe();
    httpTesting.expectOne(
      `${base}/accounting/reports/profit-loss?startDate=2026-01-01&endDate=2026-12-31&currency=USD`
    ).flush({});
  });

  it('getBalanceSheet() → GET /accounting/reports/balance-sheet?asOfDate=…', () => {
    service.getBalanceSheet('2026-06-30').subscribe();
    httpTesting.expectOne(
      `${base}/accounting/reports/balance-sheet?asOfDate=2026-06-30`
    ).flush({});
  });

  it('getCashFlow() → GET /accounting/reports/cash-flow?…', () => {
    service.getCashFlow('2026-01-01', '2026-06-30').subscribe();
    httpTesting.expectOne(
      `${base}/accounting/reports/cash-flow?startDate=2026-01-01&endDate=2026-06-30`
    ).flush([]);
  });
});
