import { inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { computed } from '@angular/core';
import { pipe, switchMap, tap } from 'rxjs';
import { Receipt, CreateReceiptDto, UpdateReceiptDto } from '../core/models/receipt.model';
import { ApiService } from '../core/services/api.service';
import { tapResponse } from '@ngrx/operators';

interface ReceiptsState {
  receipts: Receipt[];
  selectedReceipt: Receipt | null;
  loading: boolean;
  error: string | null;
}

const initialState: ReceiptsState = {
  receipts: [],
  selectedReceipt: null,
  loading: false,
  error: null,
};

export const ReceiptsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    totalReceipts: computed(() => store.receipts().length),
    draftCount: computed(() => store.receipts().filter((r) => r.status === 'draft').length),
    paidCount: computed(() => store.receipts().filter((r) => r.status === 'paid').length),
  })),
  withMethods((store, api = inject(ApiService)) => ({
    loadReceipts: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          api.getReceipts().pipe(
            tapResponse({
              next: (receipts: Receipt[]) => patchState(store, { receipts, loading: false }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    createReceipt: rxMethod<CreateReceiptDto>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((dto) =>
          api.createReceipt(dto).pipe(
            tapResponse({
              next: (receipt: Receipt) =>
                patchState(store, {
                  receipts: [receipt, ...store.receipts()],
                  loading: false,
                }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    updateReceipt: rxMethod<{ id: number; dto: UpdateReceiptDto }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ id, dto }) =>
          api.updateReceipt(id, dto).pipe(
            tapResponse({
              next: (updated: Receipt) =>
                patchState(store, {
                  receipts: store.receipts().map((r) => (r.id === id ? updated : r)),
                  selectedReceipt: store.selectedReceipt()?.id === id ? updated : store.selectedReceipt(),
                  loading: false,
                }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    deleteReceipt: rxMethod<number>(
      pipe(
        switchMap((id) =>
          api.deleteReceipt(id).pipe(
            tapResponse({
              next: () =>
                patchState(store, {
                  receipts: store.receipts().filter((r) => r.id !== id),
                }),
              error: (error: Error) => patchState(store, { error: error.message }),
            })
          )
        )
      )
    ),

    selectReceipt(receipt: Receipt | null): void {
      patchState(store, { selectedReceipt: receipt });
    },
  }))
);
