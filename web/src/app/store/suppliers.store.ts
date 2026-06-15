import { inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { computed } from '@angular/core';
import { pipe, switchMap, tap } from 'rxjs';
import { Supplier, CreateSupplierDto } from '../core/models/supplier.model';
import { ApiService } from '../core/services/api.service';
import { tapResponse } from '@ngrx/operators';

interface SuppliersState {
  suppliers: Supplier[];
  selectedSupplier: Supplier | null;
  loading: boolean;
  error: string | null;
}

const initialState: SuppliersState = {
  suppliers: [],
  selectedSupplier: null,
  loading: false,
  error: null,
};

export const SuppliersStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    totalSuppliers: computed(() => store.suppliers().length),
  })),
  withMethods((store, api = inject(ApiService)) => ({
    setSuppliers(suppliers: Supplier[]): void {
      patchState(store, { suppliers });
    },

    loadSuppliers: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          api.getSuppliers().pipe(
            tapResponse({
              next: (suppliers: Supplier[]) => patchState(store, { suppliers, loading: false }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    createSupplier: rxMethod<CreateSupplierDto>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((dto) =>
          api.createSupplier(dto).pipe(
            tapResponse({
              next: (supplier: Supplier) =>
                patchState(store, {
                  suppliers: [...store.suppliers(), supplier],
                  loading: false,
                }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    updateSupplier: rxMethod<{ id: number; dto: Partial<CreateSupplierDto> }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ id, dto }) =>
          api.updateSupplier(id, dto).pipe(
            tapResponse({
              next: (updated: Supplier) =>
                patchState(store, {
                  suppliers: store.suppliers().map((s) => (s.id === id ? updated : s)),
                  loading: false,
                }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    deleteSupplier: rxMethod<number>(
      pipe(
        switchMap((id) =>
          api.deleteSupplier(id).pipe(
            tapResponse({
              next: () =>
                patchState(store, {
                  suppliers: store.suppliers().filter((s) => s.id !== id),
                }),
              error: (error: Error) => patchState(store, { error: error.message }),
            })
          )
        )
      )
    ),

    selectSupplier(supplier: Supplier | null): void {
      patchState(store, { selectedSupplier: supplier });
    },
  }))
);
