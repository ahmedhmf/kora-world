import { inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { computed } from '@angular/core';
import { pipe, switchMap, tap } from 'rxjs';
import { Contact, CreateContactDto, UpdateContactDto } from '../core/models/contact.model';
import { ApiService } from '../core/services/api.service';
import { tapResponse } from '@ngrx/operators';

interface ContactsState {
  contacts: Contact[];
  selectedContact: Contact | null;
  loading: boolean;
  error: string | null;
}

const initialState: ContactsState = {
  contacts: [],
  selectedContact: null,
  loading: false,
  error: null,
};

export const ContactsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    totalContacts: computed(() => store.contacts().length),
  })),
  withMethods((store, api = inject(ApiService)) => ({
    loadContacts: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          api.getContacts().pipe(
            tapResponse({
              next: (contacts: Contact[]) => patchState(store, { contacts, loading: false }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    createContact: rxMethod<{ dto: CreateContactDto; callback?: () => void }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ dto, callback }) =>
          api.createContact(dto).pipe(
            tapResponse({
              next: (contact: Contact) => {
                patchState(store, {
                  contacts: [...store.contacts(), contact],
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

    updateContact: rxMethod<{ id: number; dto: UpdateContactDto; callback?: () => void }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ id, dto, callback }) =>
          api.updateContact(id, dto).pipe(
            tapResponse({
              next: (updated: Contact) => {
                patchState(store, {
                  contacts: store.contacts().map((c) => (c.id === id ? updated : c)),
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

    deleteContact: rxMethod<number>(
      pipe(
        switchMap((id) =>
          api.deleteContact(id).pipe(
            tapResponse({
              next: () =>
                patchState(store, {
                  contacts: store.contacts().filter((c) => c.id !== id),
                }),
              error: (error: Error) => patchState(store, { error: error.message }),
            })
          )
        )
      )
    ),

    selectContact(contact: Contact | null): void {
      patchState(store, { selectedContact: contact });
    },
  }))
);
