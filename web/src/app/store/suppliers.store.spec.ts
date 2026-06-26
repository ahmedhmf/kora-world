import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SuppliersStore } from './suppliers.store';
import { Supplier } from '../core/models/supplier.model';

const base = 'http://localhost:3000';

const makeSupplier = (id: number): Supplier =>
  ({ id, name: `Supplier ${id}`, country: 'DE', contacts: [] } as unknown as Supplier);

describe('SuppliersStore', () => {
  let store: InstanceType<typeof SuppliersStore>;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SuppliersStore, provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(SuppliersStore);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should have empty initial state', () => {
    expect(store.suppliers()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
    expect(store.selectedSupplier()).toBeNull();
    expect(store.totalSuppliers()).toBe(0);
  });

  // ─── loadSuppliers ────────────────────────────────────────────────────────

  describe('loadSuppliers', () => {
    it('sets loading:true then populates suppliers on success', (() => {
      store.loadSuppliers();
      expect(store.loading()).toBe(true);

      const suppliers = [makeSupplier(1), makeSupplier(2)];
      httpTesting.expectOne(`${base}/suppliers`).flush(suppliers);
      expect(store.suppliers()).toEqual(suppliers);
      expect(store.loading()).toBe(false);
      expect(store.error()).toBeNull();
      expect(store.totalSuppliers()).toBe(2);
    }));

    it('sets error on failure', (() => {
      store.loadSuppliers();
      httpTesting.expectOne(`${base}/suppliers`).error(new ErrorEvent('network error'));
      expect(store.error()).toBeTruthy();
      expect(store.loading()).toBe(false);
    }));
  });

  // ─── setSuppliers ─────────────────────────────────────────────────────────

  describe('setSuppliers', () => {
    it('replaces the suppliers array directly', () => {
      const suppliers = [makeSupplier(10)];
      store.setSuppliers(suppliers);
      expect(store.suppliers()).toEqual(suppliers);
    });
  });

  // ─── createSupplier ───────────────────────────────────────────────────────

  describe('createSupplier', () => {
    it('appends the new supplier on success', (() => {
      store.setSuppliers([makeSupplier(1)]);
      store.createSupplier({ name: 'New', country: 'FR' } as never);

      const newSupplier = makeSupplier(2);
      httpTesting.expectOne(`${base}/suppliers`).flush(newSupplier);
      expect(store.suppliers().length).toBe(2);
      expect(store.suppliers()[1]).toEqual(newSupplier);
    }));

    it('sets error on failure', (() => {
      store.createSupplier({ name: 'Bad', country: 'XX' } as never);
      httpTesting.expectOne(`${base}/suppliers`).error(new ErrorEvent('fail'));
      expect(store.error()).toBeTruthy();
    }));
  });

  // ─── updateSupplier ───────────────────────────────────────────────────────

  describe('updateSupplier', () => {
    it('replaces the matching supplier by id', (() => {
      store.setSuppliers([makeSupplier(1), makeSupplier(2)]);
      const updated = { ...makeSupplier(1), name: 'Updated' };

      store.updateSupplier({ id: 1, dto: { name: 'Updated' } });
      httpTesting.expectOne(`${base}/suppliers/1`).flush(updated);
      expect(store.suppliers()[0].name).toBe('Updated');
      expect(store.suppliers()[1].id).toBe(2);
    }));
  });

  // ─── deleteSupplier ───────────────────────────────────────────────────────

  describe('deleteSupplier', () => {
    it('removes the supplier by id on success', (() => {
      store.setSuppliers([makeSupplier(1), makeSupplier(2)]);
      store.deleteSupplier(1);

      httpTesting.expectOne(`${base}/suppliers/1`).flush(null);
      expect(store.suppliers().length).toBe(1);
      expect(store.suppliers()[0].id).toBe(2);
    }));
  });

  // ─── selectSupplier ───────────────────────────────────────────────────────

  describe('selectSupplier', () => {
    it('sets selectedSupplier', () => {
      const s = makeSupplier(5);
      store.selectSupplier(s);
      expect(store.selectedSupplier()).toEqual(s);
    });

    it('clears selectedSupplier when set to null', () => {
      store.selectSupplier(makeSupplier(5));
      store.selectSupplier(null);
      expect(store.selectedSupplier()).toBeNull();
    });
  });
});
