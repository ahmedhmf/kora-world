import { inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { computed } from '@angular/core';
import { pipe, switchMap, tap } from 'rxjs';
import { Prototype, CreatePrototypeDto } from '../core/models/prototype.model';
import { ApiService } from '../core/services/api.service';
import { tapResponse } from '@ngrx/operators';

interface PrototypesState {
  prototypes: Prototype[];
  selectedPrototype: Prototype | null;
  loading: boolean;
  error: string | null;
}

const initialState: PrototypesState = {
  prototypes: [],
  selectedPrototype: null,
  loading: false,
  error: null,
};

export const PrototypesStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    totalPrototypes: computed(() => store.prototypes().length),
  })),
  withMethods((store, api = inject(ApiService)) => ({
    loadPrototypes: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          api.getPrototypes().pipe(
            tapResponse({
              next: (prototypes: Prototype[]) => patchState(store, { prototypes, loading: false }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    createPrototype: rxMethod<CreatePrototypeDto>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((dto) =>
          api.createPrototype(dto).pipe(
            tapResponse({
              next: (prototype: Prototype) =>
                patchState(store, {
                  prototypes: [prototype, ...store.prototypes()],
                  loading: false,
                }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    updatePrototype: rxMethod<{ id: number; dto: Partial<CreatePrototypeDto> }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ id, dto }) =>
          api.updatePrototype(id, dto).pipe(
            tapResponse({
              next: (updated: Prototype) =>
                patchState(store, {
                  prototypes: store.prototypes().map((p) => (p.id === id ? updated : p)),
                  loading: false,
                }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    deletePrototype: rxMethod<number>(
      pipe(
        switchMap((id) =>
          api.deletePrototype(id).pipe(
            tapResponse({
              next: () =>
                patchState(store, {
                  prototypes: store.prototypes().filter((p) => p.id !== id),
                }),
              error: (error: Error) => patchState(store, { error: error.message }),
            })
          )
        )
      )
    ),

    selectPrototype(prototype: Prototype | null): void {
      patchState(store, { selectedPrototype: prototype });
    },
  }))
);
