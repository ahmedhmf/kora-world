import { inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { computed } from '@angular/core';
import { pipe, switchMap, tap } from 'rxjs';
import { B2cRequest, CreateB2cRequestDto, UpdateB2cRequestDto } from '../core/models/b2c-request.model';
import { ApiService } from '../core/services/api.service';
import { tapResponse } from '@ngrx/operators';

interface B2cRequestsState {
  requests: B2cRequest[];
  selectedRequest: B2cRequest | null;
  loading: boolean;
  error: string | null;
}

const initialState: B2cRequestsState = {
  requests: [],
  selectedRequest: null,
  loading: false,
  error: null,
};

export const B2cRequestsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    totalRequests: computed(() => store.requests().length),
    pendingRequests: computed(() => store.requests().filter(r => r.status === 'pending').length),
  })),
  withMethods((store, api = inject(ApiService)) => ({
    loadRequests: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          api.getB2cRequests().pipe(
            tapResponse({
              next: (requests: B2cRequest[]) => patchState(store, { requests, loading: false }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    createRequest: rxMethod<{ dto: CreateB2cRequestDto; callback?: () => void }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ dto, callback }) =>
          api.createB2cRequest(dto).pipe(
            tapResponse({
              next: (request: B2cRequest) => {
                patchState(store, {
                  requests: [request, ...store.requests()],
                  loading: false,
                });
                if (callback) callback();
              },
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    updateRequest: rxMethod<{ id: number; dto: UpdateB2cRequestDto; callback?: () => void }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ id, dto, callback }) =>
          api.updateB2cRequest(id, dto).pipe(
            tapResponse({
              next: (updated: B2cRequest) => {
                patchState(store, {
                  requests: store.requests().map((r) => (r.id === id ? updated : r)),
                  loading: false,
                });
                if (callback) callback();
              },
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    deleteRequest: rxMethod<number>(
      pipe(
        switchMap((id) =>
          api.deleteB2cRequest(id).pipe(
            tapResponse({
              next: () =>
                patchState(store, {
                  requests: store.requests().filter((r) => r.id !== id),
                }),
              error: (error: Error) => patchState(store, { error: error.message }),
            })
          )
        )
      )
    ),

    selectRequest(request: B2cRequest | null): void {
      patchState(store, { selectedRequest: request });
    },
  }))
);
