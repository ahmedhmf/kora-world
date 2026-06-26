import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReceiptsStore } from './receipts.store';
import { Receipt } from '../core/models/receipt.model';

const base = 'http://localhost:3000';
const makeReceipt = (id: number, status: 'draft' | 'paid' = 'draft'): Receipt =>
  ({ id, status, total: 100 } as unknown as Receipt);

describe('ReceiptsStore', () => {
  let store: InstanceType<typeof ReceiptsStore>;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ReceiptsStore, provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(ReceiptsStore);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should have empty initial state with correct computed defaults', () => {
    expect(store.receipts()).toEqual([]);
    expect(store.totalReceipts()).toBe(0);
    expect(store.draftCount()).toBe(0);
    expect(store.paidCount()).toBe(0);
  });

  describe('loadReceipts', () => {
    it('populates receipts on success and computes counts', (() => {
      store.loadReceipts();
      httpTesting.expectOne(`${base}/receipts`).flush([
        makeReceipt(1, 'draft'),
        makeReceipt(2, 'paid'),
        makeReceipt(3, 'draft'),
      ]);
      expect(store.receipts().length).toBe(3);
      expect(store.totalReceipts()).toBe(3);
      expect(store.draftCount()).toBe(2);
      expect(store.paidCount()).toBe(1);
    }));

    it('sets error on failure', (() => {
      store.loadReceipts();
      httpTesting.expectOne(`${base}/receipts`).error(new ErrorEvent('fail'));      expect(store.error()).toBeTruthy();
    }));
  });

  describe('createReceipt', () => {
    it('prepends new receipt on success', (() => {
      store.loadReceipts();
      httpTesting.expectOne(`${base}/receipts`).flush([makeReceipt(1)]);
      store.createReceipt({ accountId: 1 } as never);
      httpTesting.expectOne(`${base}/receipts`).flush(makeReceipt(2));
      expect(store.receipts()[0].id).toBe(2);
    }));
  });

  describe('updateReceipt', () => {
    it('replaces matching receipt and syncs selectedReceipt', (() => {
      store.loadReceipts();
      httpTesting.expectOne(`${base}/receipts`).flush([makeReceipt(1), makeReceipt(2)]);
      store.selectReceipt(makeReceipt(1));
      const updated = makeReceipt(1, 'paid');
      store.updateReceipt({ id: 1, dto: { status: 'paid' } as never });
      httpTesting.expectOne(`${base}/receipts/1`).flush(updated);
      expect(store.receipts()[0].status).toBe('paid');
      expect(store.selectedReceipt()?.status).toBe('paid');
    }));
  });

  describe('deleteReceipt', () => {
    it('removes receipt by id', (() => {
      store.loadReceipts();
      httpTesting.expectOne(`${base}/receipts`).flush([makeReceipt(1), makeReceipt(2)]);
      store.deleteReceipt(1);
      httpTesting.expectOne(`${base}/receipts/1`).flush(null);
      expect(store.receipts().length).toBe(1);
      expect(store.receipts()[0].id).toBe(2);
    }));
  });

  describe('selectReceipt', () => {
    it('sets and clears selectedReceipt', () => {
      const r = makeReceipt(5);
      store.selectReceipt(r);
      expect(store.selectedReceipt()).toEqual(r);
      store.selectReceipt(null);
      expect(store.selectedReceipt()).toBeNull();
    });
  });
});
