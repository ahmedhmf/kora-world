import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { B2cRequestsStore } from './b2c-requests.store';
import { B2cRequest } from '../core/models/b2c-request.model';

const base = 'http://localhost:3000';
const makeRequest = (id: number, status: 'pending' | 'fulfilled' = 'pending'): B2cRequest =>
  ({ id, notes: `Request ${id}`, status } as unknown as B2cRequest);

describe('B2cRequestsStore', () => {
  let store: InstanceType<typeof B2cRequestsStore>;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [B2cRequestsStore, provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(B2cRequestsStore);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should have empty initial state', () => {
    expect(store.requests()).toEqual([]);
    expect(store.totalRequests()).toBe(0);
    expect(store.pendingRequests()).toBe(0);
  });

  describe('loadRequests', () => {
    it('populates requests and computes pendingRequests', (() => {
      store.loadRequests();
      httpTesting.expectOne(`${base}/b2c-requests`).flush([
        makeRequest(1, 'pending'),
        makeRequest(2, 'fulfilled'),
        makeRequest(3, 'pending'),
      ]);
      expect(store.requests().length).toBe(3);
      expect(store.totalRequests()).toBe(3);
      expect(store.pendingRequests()).toBe(2);
    }));

    it('sets error on failure', (() => {
      store.loadRequests();
      httpTesting.expectOne(`${base}/b2c-requests`).error(new ErrorEvent('fail'));      expect(store.error()).toBeTruthy();
    }));
  });

  describe('createRequest', () => {
    it('prepends new request and calls callback', (() => {
      store.loadRequests();
      httpTesting.expectOne(`${base}/b2c-requests`).flush([makeRequest(1)]);
      let cbCalled = false;
      store.createRequest({ dto: { notes: 'New' } as never, callback: () => { cbCalled = true; } });
      httpTesting.expectOne(`${base}/b2c-requests`).flush(makeRequest(2));
      expect(store.requests()[0].id).toBe(2);
      expect(cbCalled).toBe(true);
    }));
  });

  describe('updateRequest', () => {
    it('replaces matching request and calls callback', (() => {
      store.loadRequests();
      httpTesting.expectOne(`${base}/b2c-requests`).flush([makeRequest(1), makeRequest(2)]);
      let cbCalled = false;
      const updated = { ...makeRequest(1, 'fulfilled') };
      store.updateRequest({ id: 1, dto: { status: 'fulfilled' } as never, callback: () => { cbCalled = true; } });
      httpTesting.expectOne(`${base}/b2c-requests/1`).flush(updated);
      expect(store.requests()[0].status).toBe('fulfilled');
      expect(cbCalled).toBe(true);
    }));
  });

  describe('deleteRequest', () => {
    it('removes request by id', (() => {
      store.loadRequests();
      httpTesting.expectOne(`${base}/b2c-requests`).flush([makeRequest(1), makeRequest(2)]);
      store.deleteRequest(1);
      httpTesting.expectOne(`${base}/b2c-requests/1`).flush(null);
      expect(store.requests().length).toBe(1);
    }));
  });

  describe('selectRequest', () => {
    it('sets and clears selectedRequest', () => {
      store.selectRequest(makeRequest(5));
      expect(store.selectedRequest()?.id).toBe(5);
      store.selectRequest(null);
      expect(store.selectedRequest()).toBeNull();
    });
  });
});
