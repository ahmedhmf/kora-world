import { inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { computed } from '@angular/core';
import { pipe, switchMap, tap } from 'rxjs';
import { Sample, CreateSampleDto } from '../core/models/sample.model';
import { ApiService } from '../core/services/api.service';
import { tapResponse } from '@ngrx/operators';

interface SamplesState {
  samples: Sample[];
  selectedSample: Sample | null;
  loading: boolean;
  error: string | null;
}

const initialState: SamplesState = {
  samples: [],
  selectedSample: null,
  loading: false,
  error: null,
};

export const SamplesStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    totalSamples: computed(() => store.samples().length),
  })),
  withMethods((store, api = inject(ApiService)) => ({
    loadSamples: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          api.getSamples().pipe(
            tapResponse({
              next: (samples: Sample[]) => patchState(store, { samples, loading: false }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    createSample: rxMethod<CreateSampleDto>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((dto) =>
          api.createSample(dto).pipe(
            tapResponse({
              next: (sample: Sample) =>
                patchState(store, {
                  samples: [sample, ...store.samples()],
                  loading: false,
                }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    updateSample: rxMethod<{ id: number; dto: Partial<CreateSampleDto> }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ id, dto }) =>
          api.updateSample(id, dto).pipe(
            tapResponse({
              next: (updated: Sample) =>
                patchState(store, {
                  samples: store.samples().map((s) => (s.id === id ? updated : s)),
                  loading: false,
                }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    deleteSample: rxMethod<number>(
      pipe(
        switchMap((id) =>
          api.deleteSample(id).pipe(
            tapResponse({
              next: () =>
                patchState(store, {
                  samples: store.samples().filter((s) => s.id !== id),
                }),
              error: (error: Error) => patchState(store, { error: error.message }),
            })
          )
        )
      )
    ),

    selectSample(sample: Sample | null): void {
      patchState(store, { selectedSample: sample });
    },
  }))
);
