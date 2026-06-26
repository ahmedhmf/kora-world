import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PurchaseOrdersStore } from './purchase-orders.store';
import { PurchaseOrder } from '../core/models/purchase-order.model';

const base = 'http://localhost:3000';
const makeOrder = (id: number): PurchaseOrder => ({ id, status: 'draft' } as unknown as PurchaseOrder);

describe('PurchaseOrdersStore', () => {
  let store: InstanceType<typeof PurchaseOrdersStore>;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PurchaseOrdersStore, provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(PurchaseOrdersStore);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should have empty initial state', () => {
    expect(store.purchaseOrders()).toEqual([]);
    expect(store.totalOrders()).toBe(0);
  });

  describe('loadPurchaseOrders', () => {
    it('populates purchaseOrders on success', (() => {
      store.loadPurchaseOrders();
      httpTesting.expectOne(`${base}/purchase-orders`).flush([makeOrder(1), makeOrder(2)]);      expect(store.purchaseOrders().length).toBe(2);
      expect(store.totalOrders()).toBe(2);
    }));

    it('sets error on failure', (() => {
      store.loadPurchaseOrders();
      httpTesting.expectOne(`${base}/purchase-orders`).error(new ErrorEvent('fail'));      expect(store.error()).toBeTruthy();
    }));
  });

  describe('loadPurchaseOrder (single)', () => {
    it('sets selectedPurchaseOrder on success', (() => {
      store.loadPurchaseOrder(5);
      httpTesting.expectOne(`${base}/purchase-orders/5`).flush(makeOrder(5));      expect(store.selectedPurchaseOrder()?.id).toBe(5);
    }));
  });

  describe('createPurchaseOrder', () => {
    it('prepends new order to the list', (() => {
      store.loadPurchaseOrders();
      httpTesting.expectOne(`${base}/purchase-orders`).flush([makeOrder(1)]);
      store.createPurchaseOrder({ supplierId: 1 } as never);
      httpTesting.expectOne(`${base}/purchase-orders`).flush(makeOrder(2));
      expect(store.purchaseOrders()[0].id).toBe(2);
    }));
  });

  describe('updatePurchaseOrder', () => {
    it('replaces the matching order and updates selectedPurchaseOrder when ids match', (() => {
      store.loadPurchaseOrders();
      httpTesting.expectOne(`${base}/purchase-orders`).flush([makeOrder(1), makeOrder(2)]);
      store.selectPurchaseOrder(makeOrder(1));
      const updated = { ...makeOrder(1), status: 'sent' };
      store.updatePurchaseOrder({ id: 1, dto: { status: 'sent' } as never });
      httpTesting.expectOne(`${base}/purchase-orders/1`).flush(updated);
      expect(store.purchaseOrders()[0].status).toBe('sent');
      expect(store.selectedPurchaseOrder()?.status).toBe('sent');
    }));

    it('does not change selectedPurchaseOrder when ids differ', (() => {
      store.loadPurchaseOrders();
      httpTesting.expectOne(`${base}/purchase-orders`).flush([makeOrder(1), makeOrder(2)]);
      store.selectPurchaseOrder(makeOrder(2));
      store.updatePurchaseOrder({ id: 1, dto: { status: 'sent' } as never });
      httpTesting.expectOne(`${base}/purchase-orders/1`).flush({ ...makeOrder(1), status: 'sent' });
      expect(store.selectedPurchaseOrder()?.id).toBe(2);
    }));
  });

  describe('deletePurchaseOrder', () => {
    it('removes order by id', (() => {
      store.loadPurchaseOrders();
      httpTesting.expectOne(`${base}/purchase-orders`).flush([makeOrder(1), makeOrder(2)]);
      store.deletePurchaseOrder(1);
      httpTesting.expectOne(`${base}/purchase-orders/1`).flush(null);
      expect(store.purchaseOrders().length).toBe(1);
      expect(store.purchaseOrders()[0].id).toBe(2);
    }));

    it('clears selectedPurchaseOrder when deleted id matches', (() => {
      store.loadPurchaseOrders();
      httpTesting.expectOne(`${base}/purchase-orders`).flush([makeOrder(1)]);
      store.selectPurchaseOrder(makeOrder(1));
      store.deletePurchaseOrder(1);
      httpTesting.expectOne(`${base}/purchase-orders/1`).flush(null);
      expect(store.selectedPurchaseOrder()).toBeNull();
    }));
  });

  describe('selectPurchaseOrder', () => {
    it('sets and clears selectedPurchaseOrder', () => {
      store.selectPurchaseOrder(makeOrder(3));
      expect(store.selectedPurchaseOrder()?.id).toBe(3);
      store.selectPurchaseOrder(null);
      expect(store.selectedPurchaseOrder()).toBeNull();
    });
  });
});
