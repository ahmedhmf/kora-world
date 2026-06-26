import { inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { computed } from '@angular/core';
import { pipe, switchMap, tap } from 'rxjs';
import { B2BAccount, CreateAccountDto } from '../core/models/account.model';
import { ApiService } from '../core/services/api.service';
import { tapResponse } from '@ngrx/operators';

interface AccountsState {
  accounts: B2BAccount[];
  selectedAccount: B2BAccount | null;
  loading: boolean;
  error: string | null;
}

const initialState: AccountsState = {
  accounts: [],
  selectedAccount: null,
  loading: false,
  error: null,
};

export const AccountsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    totalAccounts: computed(() => store.accounts().length),
  })),
  withMethods((store, api = inject(ApiService)) => ({
    loadAccounts: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          api.getAccounts().pipe(
            tapResponse({
              next: (accounts: B2BAccount[]) => patchState(store, { accounts, loading: false }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    createAccount: rxMethod<CreateAccountDto>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((dto) =>
          api.createAccount(dto).pipe(
            tapResponse({
              next: (account: B2BAccount) =>
                patchState(store, {
                  accounts: [...store.accounts(), account],
                  loading: false,
                }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    updateAccount: rxMethod<{ id: number; dto: Partial<CreateAccountDto> }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ id, dto }) =>
          api.updateAccount(id, dto).pipe(
            tapResponse({
              next: (updated: B2BAccount) =>
                patchState(store, {
                  accounts: store.accounts().map((a) => (a.id === id ? updated : a)),
                  loading: false,
                }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    deleteAccount: rxMethod<number>(
      pipe(
        switchMap((id) =>
          api.deleteAccount(id).pipe(
            tapResponse({
              next: () =>
                patchState(store, {
                  accounts: store.accounts().filter((a) => a.id !== id),
                }),
              error: (error: Error) => patchState(store, { error: error.message }),
            })
          )
        )
      )
    ),

    selectAccount(account: B2BAccount | null): void {
      patchState(store, { selectedAccount: account });
    },

    updateForecasts: rxMethod<{ id: number; forecasts: any[] }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ id, forecasts }) =>
          api.updateAccountForecasts(id, forecasts).pipe(
            tapResponse({
              next: (updated: B2BAccount) => {
                const accounts = store.accounts().map((a) => (a.id === id ? updated : a));
                const selectedAccount = store.selectedAccount()?.id === id ? updated : store.selectedAccount();
                patchState(store, { accounts, selectedAccount, loading: false });
              },
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    createPOsFromForecast: rxMethod<{ id: number; forecastId: string; selectedItems?: Array<{ productId: number; quantity: number }>; onSuccess?: () => void }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ id, forecastId, selectedItems, onSuccess }) =>
          api.createPOsFromForecast(id, forecastId, selectedItems).pipe(
            tapResponse({
              next: () => {
                // Fetch the updated account details to reflect updated forecast status
                api.getAccount(id).subscribe((updated: B2BAccount) => {
                  const accounts = store.accounts().map((a) => (a.id === id ? updated : a));
                  const selectedAccount = store.selectedAccount()?.id === id ? updated : store.selectedAccount();
                  patchState(store, { accounts, selectedAccount, loading: false });
                  if (onSuccess) onSuccess();
                });
              },
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),
  }))
);
