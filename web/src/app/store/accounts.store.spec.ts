import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AccountsStore } from './accounts.store';
import { B2BAccount } from '../core/models/account.model';

const base = 'http://localhost:3000';
const makeAccount = (id: number): B2BAccount =>
  ({ id, companyName: `Company ${id}`, accountNumber: `ACC-000${id}` } as unknown as B2BAccount);

describe('AccountsStore', () => {
  let store: InstanceType<typeof AccountsStore>;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AccountsStore, provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(AccountsStore);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should have empty initial state', () => {
    expect(store.accounts()).toEqual([]);
    expect(store.totalAccounts()).toBe(0);
  });

  describe('loadAccounts', () => {
    it('populates accounts on success', (() => {
      store.loadAccounts();
      httpTesting.expectOne(`${base}/accounts`).flush([makeAccount(1), makeAccount(2)]);      expect(store.accounts().length).toBe(2);
      expect(store.totalAccounts()).toBe(2);
    }));

    it('sets error on failure', (() => {
      store.loadAccounts();
      httpTesting.expectOne(`${base}/accounts`).error(new ErrorEvent('fail'));      expect(store.error()).toBeTruthy();
    }));
  });

  describe('createAccount', () => {
    it('appends new account on success', (() => {
      store.loadAccounts();
      httpTesting.expectOne(`${base}/accounts`).flush([makeAccount(1)]);
      store.createAccount({ companyName: 'New Corp' } as never);
      httpTesting.expectOne(`${base}/accounts`).flush(makeAccount(2));
      expect(store.accounts().length).toBe(2);
      expect(store.accounts()[1].id).toBe(2);
    }));
  });

  describe('updateAccount', () => {
    it('replaces matching account by id', (() => {
      store.loadAccounts();
      httpTesting.expectOne(`${base}/accounts`).flush([makeAccount(1), makeAccount(2)]);
      const updated = { ...makeAccount(1), companyName: 'Updated Corp' };
      store.updateAccount({ id: 1, dto: { companyName: 'Updated Corp' } });
      httpTesting.expectOne(`${base}/accounts/1`).flush(updated);
      expect(store.accounts()[0].companyName).toBe('Updated Corp');
    }));
  });

  describe('deleteAccount', () => {
    it('removes account by id', (() => {
      store.loadAccounts();
      httpTesting.expectOne(`${base}/accounts`).flush([makeAccount(1), makeAccount(2)]);
      store.deleteAccount(1);
      httpTesting.expectOne(`${base}/accounts/1`).flush(null);
      expect(store.accounts().length).toBe(1);
      expect(store.accounts()[0].id).toBe(2);
    }));
  });

  describe('selectAccount', () => {
    it('sets and clears selectedAccount', () => {
      store.selectAccount(makeAccount(3));
      expect(store.selectedAccount()?.id).toBe(3);
      store.selectAccount(null);
      expect(store.selectedAccount()).toBeNull();
    });
  });
});
