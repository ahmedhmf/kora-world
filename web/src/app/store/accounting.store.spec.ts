import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AccountingStore } from './accounting.store';
import {
  AccountingApiService,
  AccountingAccount,
  JournalEntry,
  Invoice,
  Payment,
} from '../core/services/accounting-api.service';

const makeAccount = (id: number): AccountingAccount =>
  ({ id, code: `${1000 + id}`, name: `Account ${id}`, type: 'asset', currency: 'EGP', isActive: true });

const makeJournalEntry = (id: number): JournalEntry =>
  ({ id, date: '2026-01-01', type: 'manual', lines: [], createdAt: '2026-01-01T00:00:00Z' });

const makeInvoice = (id: number): Invoice =>
  ({ id, number: `INV-${id}`, type: 'incoming', date: '2026-01-01', dueDate: '2026-01-15',
     status: 'draft', currency: 'EGP', subtotal: 1000, tax: 150, total: 1150, lines: [] });

const makePayment = (id: number): Payment =>
  ({ id, date: '2026-01-01', amount: 500, currency: 'EGP', exchangeRate: 1, amountBase: 500,
     method: 'bank', description: 'Payment', paidFromAccountId: 1, categoryAccountId: 2 });

describe('AccountingStore', () => {
  let store: InstanceType<typeof AccountingStore>;
  let apiMock: any;

  beforeEach(() => {
    apiMock = {
      getAccounts: vi.fn().mockReturnValue(of([])),
      getAccountTree: vi.fn().mockReturnValue(of([])),
      createAccount: vi.fn(),
      updateAccount: vi.fn(),
      getJournalEntries: vi.fn().mockReturnValue(of([])),
      createManualJournalEntry: vi.fn(),
      getInvoices: vi.fn().mockReturnValue(of([])),
      createInvoice: vi.fn(),
      updateInvoice: vi.fn(),
      deleteInvoice: vi.fn(),
      getPayments: vi.fn().mockReturnValue(of([])),
      createPayment: vi.fn(),
      deletePayment: vi.fn(),
      getProfitAndLoss: vi.fn().mockReturnValue(of({})),
      getBalanceSheet: vi.fn().mockReturnValue(of({})),
      getCashFlow: vi.fn().mockReturnValue(of([])),
    };

    TestBed.configureTestingModule({
      providers: [
        AccountingStore,
        { provide: AccountingApiService, useValue: apiMock }
      ],
    });
    store = TestBed.inject(AccountingStore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have empty initial state', () => {
    expect(store.accounts()).toEqual([]);
    expect(store.accountTree()).toEqual([]);
    expect(store.journalEntries()).toEqual([]);
    expect(store.invoices()).toEqual([]);
    expect(store.payments()).toEqual([]);
    expect(store.profitLoss()).toBeNull();
    expect(store.balanceSheet()).toBeNull();
    expect(store.cashFlow()).toBeNull();
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  // ─── loadAccounts ─────────────────────────────────────────────────────────

  describe('loadAccounts', () => {
    it('populates accounts on success', () => {
      apiMock.getAccounts.mockReturnValue(of([makeAccount(1)]));
      store.loadAccounts();
      expect(store.accounts().length).toBe(1);
      expect(store.loading()).toBe(false);
    });

    it('sets error on failure', () => {
      apiMock.getAccounts.mockReturnValue(throwError(() => new Error('fail')));
      store.loadAccounts();
      expect(store.error()).toBeTruthy();
    });
  });

  // ─── loadAccountTree ──────────────────────────────────────────────────────

  describe('loadAccountTree', () => {
    it('populates accountTree on success', () => {
      apiMock.getAccountTree.mockReturnValue(of([makeAccount(1)]));
      store.loadAccountTree();
      expect(store.accountTree().length).toBe(1);
    });
  });

  // ─── createAccount ────────────────────────────────────────────────────────

  describe('createAccount', () => {
    it('appends new account on success', () => {
      apiMock.getAccounts.mockReturnValue(of([makeAccount(1)]));
      store.loadAccounts();
      
      apiMock.createAccount.mockReturnValue(of(makeAccount(2)));
      store.createAccount({ code: '1002', name: 'New Account', type: 'asset' });
      
      expect(store.accounts().length).toBe(2);
    });
  });

  // ─── updateAccount ────────────────────────────────────────────────────────

  describe('updateAccount', () => {
    it('replaces matching account by id', () => {
      apiMock.getAccounts.mockReturnValue(of([makeAccount(1), makeAccount(2)]));
      store.loadAccounts();
      
      const updated = { ...makeAccount(1), name: 'Updated Account' };
      apiMock.updateAccount.mockReturnValue(of(updated));
      store.updateAccount({ id: 1, dto: { name: 'Updated Account' } });
      
      expect(store.accounts()[0].name).toBe('Updated Account');
    });
  });

  // ─── loadJournalEntries ───────────────────────────────────────────────────

  describe('loadJournalEntries', () => {
    it('populates journalEntries on success', () => {
      apiMock.getJournalEntries.mockReturnValue(of([makeJournalEntry(1)]));
      store.loadJournalEntries();
      expect(store.journalEntries().length).toBe(1);
    });
  });

  // ─── createManualJournalEntry ─────────────────────────────────────────────

  describe('createManualJournalEntry', () => {
    it('prepends the new entry and calls onSuccess', () => {
      apiMock.getJournalEntries.mockReturnValue(of([makeJournalEntry(1)]));
      store.loadJournalEntries();
      
      let cbCalled = false;
      apiMock.createManualJournalEntry.mockReturnValue(of(makeJournalEntry(2)));
      store.createManualJournalEntry({ dto: { lines: [] }, onSuccess: () => { cbCalled = true; } });
      
      expect(store.journalEntries()[0].id).toBe(2);
      expect(cbCalled).toBe(true);
    });

    it('works without onSuccess callback', () => {
      apiMock.createManualJournalEntry.mockReturnValue(of(makeJournalEntry(1)));
      store.createManualJournalEntry({ dto: { lines: [] } });
      expect(store.journalEntries().length).toBe(1);
    });
  });

  // ─── loadInvoices ─────────────────────────────────────────────────────────

  describe('loadInvoices', () => {
    it('populates invoices on success', () => {
      apiMock.getInvoices.mockReturnValue(of([makeInvoice(1), makeInvoice(2)]));
      store.loadInvoices();
      expect(store.invoices().length).toBe(2);
    });
  });

  // ─── createInvoice ────────────────────────────────────────────────────────

  describe('createInvoice', () => {
    it('prepends new invoice and calls onSuccess', () => {
      apiMock.getInvoices.mockReturnValue(of([makeInvoice(1)]));
      store.loadInvoices();
      
      let cbCalled = false;
      apiMock.createInvoice.mockReturnValue(of(makeInvoice(2)));
      store.createInvoice({ dto: { type: 'incoming' }, onSuccess: () => { cbCalled = true; } });
      
      expect(store.invoices()[0].id).toBe(2);
      expect(cbCalled).toBe(true);
    });

    it('parses HttpErrorResponse error message on failure', () => {
      const errRes = new HttpErrorResponse({
        error: { message: 'Validation failed' },
        status: 400,
        statusText: 'Bad Request'
      });
      apiMock.createInvoice.mockReturnValue(throwError(() => errRes));
      store.createInvoice({ dto: { type: 'incoming' } });
      expect(store.error()).toContain('Validation failed');
    });

    it('parses array error.message from HttpErrorResponse', () => {
      const errRes = new HttpErrorResponse({
        error: { message: ['Field A is required', 'Field B is required'] },
        status: 400,
        statusText: 'Bad Request'
      });
      apiMock.createInvoice.mockReturnValue(throwError(() => errRes));
      store.createInvoice({ dto: { type: 'incoming' } });
      expect(store.error()).toBe('Field A is required, Field B is required');
    });
  });

  // ─── updateInvoice ────────────────────────────────────────────────────────

  describe('updateInvoice', () => {
    it('replaces matching invoice and calls onSuccess', () => {
      apiMock.getInvoices.mockReturnValue(of([makeInvoice(1), makeInvoice(2)]));
      store.loadInvoices();
      
      let cbCalled = false;
      const updated = { ...makeInvoice(1), status: 'sent' };
      apiMock.updateInvoice.mockReturnValue(of(updated));
      store.updateInvoice({ id: 1, dto: { status: 'sent' }, onSuccess: () => { cbCalled = true; } });
      
      expect(store.invoices()[0].status).toBe('sent');
      expect(cbCalled).toBe(true);
    });
  });

  // ─── deleteInvoice ────────────────────────────────────────────────────────

  describe('deleteInvoice', () => {
    it('removes invoice by id', () => {
      apiMock.getInvoices.mockReturnValue(of([makeInvoice(1), makeInvoice(2)]));
      store.loadInvoices();
      
      apiMock.deleteInvoice.mockReturnValue(of(null));
      store.deleteInvoice(1);
      
      expect(store.invoices().length).toBe(1);
      expect(store.invoices()[0].id).toBe(2);
    });
  });

  // ─── loadPayments ─────────────────────────────────────────────────────────

  describe('loadPayments', () => {
    it('populates payments on success', () => {
      apiMock.getPayments.mockReturnValue(of([makePayment(1)]));
      store.loadPayments();
      expect(store.payments().length).toBe(1);
    });
  });

  // ─── createPayment ────────────────────────────────────────────────────────  // ─── createPayment ────────────────────────────────────────────────────────

  describe('createPayment', () => {
    it('prepends new payment on success and triggers refresh calls', () => {
      apiMock.createPayment.mockReturnValue(of(makePayment(1)));
      store.createPayment({ dto: { amount: 500 } });
      
      return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          try {
            console.log('STORE ERROR:', store.error());
            expect(store.payments().length).toBe(1);
            expect(apiMock.getInvoices).toHaveBeenCalled();
            expect(apiMock.getJournalEntries).toHaveBeenCalled();
            expect(apiMock.getAccounts).toHaveBeenCalled();
            resolve();
          } catch (e) {
            reject(e);
          }
        }, 50);
      });
    });
  });

  // ─── deletePayment ────────────────────────────────────────────────────────

  describe('deletePayment', () => {
    it('removes payment by id and triggers refresh calls', () => {
      apiMock.getPayments.mockReturnValue(of([makePayment(1), makePayment(2)]));
      store.loadPayments();
      
      apiMock.deletePayment.mockReturnValue(of(null));
      store.deletePayment(1);
      
      return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          try {
            console.log('STORE DELETE ERROR:', store.error());
            expect(store.payments().length).toBe(1);
            expect(apiMock.getInvoices).toHaveBeenCalled();
            expect(apiMock.getJournalEntries).toHaveBeenCalled();
            expect(apiMock.getAccounts).toHaveBeenCalled();
            resolve();
          } catch (e) {
            reject(e);
          }
        }, 50);
      });
    });
  });

  // ─── loadProfitAndLoss ────────────────────────────────────────────────────

  describe('loadProfitAndLoss', () => {
    it('populates profitLoss on success', () => {
      const mockPL = { revenue: 10000, expenses: 6000, net: 4000, currency: 'EGP' };
      apiMock.getProfitAndLoss.mockReturnValue(of(mockPL));
      
      store.loadProfitAndLoss({ startDate: '2026-01-01', endDate: '2026-12-31' });
      expect(store.profitLoss()).toEqual(mockPL);
    });

    it('populates profitLoss with optional currency', () => {
      apiMock.getProfitAndLoss.mockReturnValue(of({}));
      store.loadProfitAndLoss({ startDate: '2026-01-01', endDate: '2026-12-31', currency: 'USD' });
      expect(store.profitLoss()).toBeTruthy();
    });
  });

  // ─── loadBalanceSheet ─────────────────────────────────────────────────────

  describe('loadBalanceSheet', () => {
    it('populates balanceSheet on success', () => {
      const mockBS = { assets: 50000, liabilities: 20000, equity: 30000 };
      apiMock.getBalanceSheet.mockReturnValue(of(mockBS));
      
      store.loadBalanceSheet({ asOfDate: '2026-06-30' });
      expect(store.balanceSheet()).toEqual(mockBS);
    });
  });

  // ─── loadCashFlow ─────────────────────────────────────────────────────────

  describe('loadCashFlow', () => {
    it('populates cashFlow on success', () => {
      const mockCF = [{ period: '2026-01', inflow: 5000, outflow: 3000 }];
      apiMock.getCashFlow.mockReturnValue(of(mockCF));
      
      store.loadCashFlow({ startDate: '2026-01-01', endDate: '2026-06-30' });
      expect(store.cashFlow()).toEqual(mockCF);
    });
  });
});
