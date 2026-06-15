import { inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { computed } from '@angular/core';
import { pipe, switchMap, tap } from 'rxjs';
import { CalendarEvent, CreateEventDto } from '../core/models/event.model';
import { ApiService } from '../core/services/api.service';
import { tapResponse } from '@ngrx/operators';

interface EventsState {
  events: CalendarEvent[];
  selectedEvent: CalendarEvent | null;
  loading: boolean;
  error: string | null;
}

const initialState: EventsState = {
  events: [],
  selectedEvent: null,
  loading: false,
  error: null,
};

export const EventsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    totalEvents: computed(() => store.events().length),
  })),
  withMethods((store, api = inject(ApiService)) => ({
    loadEvents: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          api.getEvents().pipe(
            tapResponse({
              next: (events: CalendarEvent[]) => patchState(store, { events, loading: false }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    createEvent: rxMethod<CreateEventDto>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((dto) =>
          api.createEvent(dto).pipe(
            tapResponse({
              next: (event: CalendarEvent) =>
                patchState(store, {
                  events: [...store.events(), event],
                  loading: false,
                }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    updateEvent: rxMethod<{ id: number; dto: Partial<CreateEventDto> }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ id, dto }) =>
          api.updateEvent(id, dto).pipe(
            tapResponse({
              next: (updated: CalendarEvent) =>
                patchState(store, {
                  events: store.events().map((e) => (e.id === id ? updated : e)),
                  loading: false,
                }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    deleteEvent: rxMethod<number>(
      pipe(
        switchMap((id) =>
          api.deleteEvent(id).pipe(
            tapResponse({
              next: () =>
                patchState(store, {
                  events: store.events().filter((e) => e.id !== id),
                }),
              error: (error: Error) => patchState(store, { error: error.message }),
            })
          )
        )
      )
    ),

    selectEvent(event: CalendarEvent | null): void {
      patchState(store, { selectedEvent: event });
    },
  }))
);
