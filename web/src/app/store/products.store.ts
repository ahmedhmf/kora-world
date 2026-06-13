import { inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { computed } from '@angular/core';
import { pipe, switchMap, tap } from 'rxjs';
import { Product, CreateProductDto, ProductCategory } from '../core/models/product.model';
import { ApiService } from '../core/services/api.service';
import { tapResponse } from '@ngrx/operators';

interface ProductsState {
  products: Product[];
  selectedProduct: Product | null;
  filterSupplierId: number | null;
  filterCategory: ProductCategory | null;
  loading: boolean;
  error: string | null;
}

const initialState: ProductsState = {
  products: [],
  selectedProduct: null,
  filterSupplierId: null,
  filterCategory: null,
  loading: false,
  error: null,
};

export const ProductsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    totalProducts: computed(() => store.products().length),
    filteredProducts: computed(() => {
      let products = store.products();
      if (store.filterCategory()) {
        products = products.filter((p) => p.category === store.filterCategory());
      }
      return products;
    }),
  })),
  withMethods((store, api = inject(ApiService)) => ({
    loadProducts: rxMethod<{ supplierId?: number; category?: string }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ supplierId, category }) =>
          api.getProducts(supplierId, category).pipe(
            tapResponse({
              next: (products: Product[]) => patchState(store, { products, loading: false }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    createProduct: rxMethod<CreateProductDto>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((dto) =>
          api.createProduct(dto).pipe(
            tapResponse({
              next: (product: Product) =>
                patchState(store, {
                  products: [...store.products(), product],
                  loading: false,
                }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    updateProduct: rxMethod<{ id: number; dto: Partial<CreateProductDto> }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ id, dto }) =>
          api.updateProduct(id, dto).pipe(
            tapResponse({
              next: (updated: Product) =>
                patchState(store, {
                  products: store.products().map((p) => (p.id === id ? updated : p)),
                  loading: false,
                }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    deleteProduct: rxMethod<number>(
      pipe(
        switchMap((id) =>
          api.deleteProduct(id).pipe(
            tapResponse({
              next: () =>
                patchState(store, {
                  products: store.products().filter((p) => p.id !== id),
                }),
              error: (error: Error) => patchState(store, { error: error.message }),
            })
          )
        )
      )
    ),

    setFilter(supplierId: number | null, category: ProductCategory | null): void {
      patchState(store, { filterSupplierId: supplierId, filterCategory: category });
    },

    selectProduct(product: Product | null): void {
      patchState(store, { selectedProduct: product });
    },
  }))
);
