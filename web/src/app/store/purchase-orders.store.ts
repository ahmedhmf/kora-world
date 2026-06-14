import { inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { computed } from '@angular/core';
import { pipe, switchMap, tap } from 'rxjs';
import { PurchaseOrder, CreatePurchaseOrderDto } from '../core/models/purchase-order.model';
import { ApiService } from '../core/services/api.service';
import { tapResponse } from '@ngrx/operators';

interface PurchaseOrdersState {
  purchaseOrders: PurchaseOrder[];
  selectedPurchaseOrder: PurchaseOrder | null;
  loading: boolean;
  error: string | null;
}

const initialState: PurchaseOrdersState = {
  purchaseOrders: [],
  selectedPurchaseOrder: null,
  loading: false,
  error: null,
};

export const PurchaseOrdersStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    totalOrders: computed(() => store.purchaseOrders().length),
  })),
  withMethods((store, api = inject(ApiService)) => ({
    loadPurchaseOrders: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          api.getPurchaseOrders().pipe(
            tapResponse({
              next: (purchaseOrders: PurchaseOrder[]) => patchState(store, { purchaseOrders, loading: false }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    loadPurchaseOrder: rxMethod<number>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((id) =>
          api.getPurchaseOrder(id).pipe(
            tapResponse({
              next: (selectedPurchaseOrder: PurchaseOrder) => patchState(store, { selectedPurchaseOrder, loading: false }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    createPurchaseOrder: rxMethod<CreatePurchaseOrderDto>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((dto) =>
          api.createPurchaseOrder(dto).pipe(
            tapResponse({
              next: (order: PurchaseOrder) =>
                patchState(store, {
                  purchaseOrders: [order, ...store.purchaseOrders()],
                  loading: false,
                }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    updatePurchaseOrder: rxMethod<{ id: number; dto: Partial<CreatePurchaseOrderDto> }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ id, dto }) =>
          api.updatePurchaseOrder(id, dto).pipe(
            tapResponse({
              next: (updated: PurchaseOrder) =>
                patchState(store, {
                  purchaseOrders: store.purchaseOrders().map((o) => (o.id === id ? updated : o)),
                  selectedPurchaseOrder: store.selectedPurchaseOrder()?.id === id ? updated : store.selectedPurchaseOrder(),
                  loading: false,
                }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    deletePurchaseOrder: rxMethod<number>(
      pipe(
        switchMap((id) =>
          api.deletePurchaseOrder(id).pipe(
            tapResponse({
              next: () =>
                patchState(store, {
                  purchaseOrders: store.purchaseOrders().filter((o) => o.id !== id),
                  selectedPurchaseOrder: store.selectedPurchaseOrder()?.id === id ? null : store.selectedPurchaseOrder(),
                }),
              error: (error: Error) => patchState(store, { error: error.message }),
            })
          )
        )
      )
    ),

    selectPurchaseOrder(order: PurchaseOrder | null): void {
      patchState(store, { selectedPurchaseOrder: order });
    },
  }))
);
