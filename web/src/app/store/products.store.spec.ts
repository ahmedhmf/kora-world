import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProductsStore } from './products.store';
import { Product } from '../core/models/product.model';

const base = 'http://localhost:3000';

const makeProduct = (id: number, category = 'football'): Product =>
  ({ id, name: `Product ${id}`, category } as unknown as Product);

describe('ProductsStore', () => {
  let store: InstanceType<typeof ProductsStore>;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProductsStore, provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(ProductsStore);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should have empty initial state', () => {
    expect(store.products()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
    expect(store.totalProducts()).toBe(0);
  });

  // ─── loadProducts ─────────────────────────────────────────────────────────

  describe('loadProducts', () => {
    it('populates products on success', (() => {
      const products = [makeProduct(1), makeProduct(2)];
      store.loadProducts({});

      httpTesting.expectOne(`${base}/products`).flush(products);
      expect(store.products()).toEqual(products);
      expect(store.loading()).toBe(false);
    }));

    it('sets error on failure', (() => {
      store.loadProducts({});
      httpTesting.expectOne(`${base}/products`).error(new ErrorEvent('fail'));      expect(store.error()).toBeTruthy();
    }));
  });

  // ─── filteredProducts computed ────────────────────────────────────────────

  describe('filteredProducts', () => {
    it('returns all products when no filter is set', (() => {
      store.loadProducts({});
      httpTesting.expectOne(`${base}/products`).flush([makeProduct(1), makeProduct(2, 'running')]);
      expect(store.filteredProducts().length).toBe(2);
    }));

    it('returns only products matching the filterCategory', (() => {
      store.loadProducts({});
      httpTesting.expectOne(`${base}/products`).flush([makeProduct(1), makeProduct(2, 'running')]);
      store.setFilter(null, 'football' as never);
      expect(store.filteredProducts().length).toBe(1);
      expect(store.filteredProducts()[0].category).toBe('football');
    }));
  });

  // ─── createProduct ────────────────────────────────────────────────────────

  describe('createProduct', () => {
    it('appends the new product on success', (() => {
      store.loadProducts({});
      httpTesting.expectOne(`${base}/products`).flush([makeProduct(1)]);
      store.createProduct({ name: 'New', category: 'football' } as never);
      httpTesting.expectOne(`${base}/products`).flush(makeProduct(2));
      expect(store.products().length).toBe(2);
    }));
  });

  // ─── updateProduct ────────────────────────────────────────────────────────

  describe('updateProduct', () => {
    it('replaces matching product by id', (() => {
      store.loadProducts({});
      httpTesting.expectOne(`${base}/products`).flush([makeProduct(1), makeProduct(2)]);
      const updated = { ...makeProduct(1), name: 'Updated' };
      store.updateProduct({ id: 1, dto: { name: 'Updated' } });
      httpTesting.expectOne(`${base}/products/1`).flush(updated);
      expect(store.products()[0].name).toBe('Updated');
    }));
  });

  // ─── deleteProduct ────────────────────────────────────────────────────────

  describe('deleteProduct', () => {
    it('removes product by id', (() => {
      store.loadProducts({});
      httpTesting.expectOne(`${base}/products`).flush([makeProduct(1), makeProduct(2)]);
      store.deleteProduct(1);
      httpTesting.expectOne(`${base}/products/1`).flush(null);
      expect(store.products().length).toBe(1);
      expect(store.products()[0].id).toBe(2);
    }));
  });

  // ─── setFilter / selectProduct ────────────────────────────────────────────

  describe('setFilter', () => {
    it('updates filterSupplierId and filterCategory', () => {
      store.setFilter(5, 'running' as never);
      expect(store.filterSupplierId()).toBe(5);
      expect(store.filterCategory()).toBe('running');
    });
  });

  describe('selectProduct', () => {
    it('sets selectedProduct', () => {
      const p = makeProduct(3);
      store.selectProduct(p);
      expect(store.selectedProduct()).toEqual(p);
    });

    it('clears selectedProduct when null', () => {
      store.selectProduct(makeProduct(3));
      store.selectProduct(null);
      expect(store.selectedProduct()).toBeNull();
    });
  });
});
