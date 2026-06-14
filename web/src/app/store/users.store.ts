import { inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { computed } from '@angular/core';
import { pipe, switchMap, tap } from 'rxjs';
import { User, CreateUserDto } from '../core/models/user.model';
import { ApiService } from '../core/services/api.service';
import { tapResponse } from '@ngrx/operators';

interface UsersState {
  users: User[];
  selectedUser: User | null;
  loading: boolean;
  error: string | null;
}

const initialState: UsersState = {
  users: [],
  selectedUser: null,
  loading: false,
  error: null,
};

export const UsersStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    totalUsers: computed(() => store.users().length),
  })),
  withMethods((store, api = inject(ApiService)) => ({
    loadUsers: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          api.getUsers().pipe(
            tapResponse({
              next: (users: User[]) => patchState(store, { users, loading: false }),
              error: (error: any) => patchState(store, { error: error.error?.message || error.message, loading: false }),
            })
          )
        )
      )
    ),

    createUser: rxMethod<CreateUserDto>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((dto) =>
          api.createUser(dto).pipe(
            tapResponse({
              next: (user: User) =>
                patchState(store, {
                  users: [...store.users(), user],
                  loading: false,
                }),
              error: (error: any) => patchState(store, { error: error.error?.message || error.message, loading: false }),
            })
          )
        )
      )
    ),

    updateUser: rxMethod<{ id: number; dto: Partial<CreateUserDto> }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ id, dto }) =>
          api.updateUser(id, dto).pipe(
            tapResponse({
              next: (updated: User) =>
                patchState(store, {
                  users: store.users().map((u) => (u.id === id ? updated : u)),
                  loading: false,
                }),
              error: (error: any) => patchState(store, { error: error.error?.message || error.message, loading: false }),
            })
          )
        )
      )
    ),

    deleteUser: rxMethod<number>(
      pipe(
        switchMap((id) =>
          api.deleteUser(id).pipe(
            tapResponse({
              next: () =>
                patchState(store, {
                  users: store.users().filter((u) => u.id !== id),
                }),
              error: (error: any) => patchState(store, { error: error.error?.message || error.message }),
            })
          )
        )
      )
    ),

    selectUser(user: User | null): void {
      patchState(store, { selectedUser: user });
    },
  }))
);
