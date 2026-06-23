import { inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap } from 'rxjs';
import {
  AccountingApiService,
  AccountingAccount,
  JournalEntry,
  Invoice,
  Payment,
} from '../core/services/accounting-api.service';
import { tapResponse } from '@ngrx/operators';

const parseErrorMessage = (error: any): string => {
  if (error instanceof HttpErrorResponse) {
    if (error.error && error.error.message) {
      if (Array.isArray(error.error.message)) {
        return error.error.message.join(', ');
      }
      return error.error.message;
    }
  }
  return error.message || 'Unknown error occurred';
};

interface AccountingState {
  accounts: AccountingAccount[];
  accountTree: AccountingAccount[];
  journalEntries: JournalEntry[];
  invoices: Invoice[];
  payments: Payment[];
  profitLoss: any | null;
  balanceSheet: any | null;
  cashFlow: any[] | null;
  loading: boolean;
  error: string | null;
}

const initialState: AccountingState = {
  accounts: [],
  accountTree: [],
  journalEntries: [],
  invoices: [],
  payments: [],
  profitLoss: null,
  balanceSheet: null,
  cashFlow: null,
  loading: false,
  error: null,
};

export const AccountingStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(AccountingApiService)) => ({
    loadAccounts: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          api.getAccounts().pipe(
            tapResponse({
              next: (accounts) => patchState(store, { accounts, loading: false }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    loadAccountTree: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          api.getAccountTree().pipe(
            tapResponse({
              next: (accountTree) => patchState(store, { accountTree, loading: false }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    createAccount: rxMethod<any>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((dto) =>
          api.createAccount(dto).pipe(
            tapResponse({
              next: (account) => {
                patchState(store, {
                  accounts: [...store.accounts(), account],
                  loading: false,
                });
              },
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    updateAccount: rxMethod<{ id: number; dto: any }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ id, dto }) =>
          api.updateAccount(id, dto).pipe(
            tapResponse({
              next: (updated) => {
                patchState(store, {
                  accounts: store.accounts().map((a) => (a.id === id ? updated : a)),
                  loading: false,
                });
              },
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    loadJournalEntries: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          api.getJournalEntries().pipe(
            tapResponse({
              next: (journalEntries) => patchState(store, { journalEntries, loading: false }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    createManualJournalEntry: rxMethod<{ dto: any; onSuccess?: () => void }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ dto, onSuccess }) =>
          api.createManualJournalEntry(dto).pipe(
            tapResponse({
              next: (entry) => {
                patchState(store, {
                  journalEntries: [entry, ...store.journalEntries()],
                  loading: false,
                });
                if (onSuccess) onSuccess();
              },
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    loadInvoices: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          api.getInvoices().pipe(
            tapResponse({
              next: (invoices) => patchState(store, { invoices, loading: false }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    createInvoice: rxMethod<{ dto: any; onSuccess?: () => void }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ dto, onSuccess }) =>
          api.createInvoice(dto).pipe(
            tapResponse({
              next: (invoice) => {
                patchState(store, {
                  invoices: [invoice, ...store.invoices()],
                  loading: false,
                });
                if (onSuccess) onSuccess();
              },
              error: (error: any) => patchState(store, { error: parseErrorMessage(error), loading: false }),
            })
          )
        )
      )
    ),

    updateInvoice: rxMethod<{ id: number; dto: any; onSuccess?: () => void }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ id, dto, onSuccess }) =>
          api.updateInvoice(id, dto).pipe(
            tapResponse({
              next: (updated) => {
                patchState(store, {
                  invoices: store.invoices().map((inv) => (inv.id === id ? updated : inv)),
                  loading: false,
                });
                if (onSuccess) onSuccess();
              },
              error: (error: any) => patchState(store, { error: parseErrorMessage(error), loading: false }),
            })
          )
        )
      )
    ),

    deleteInvoice: rxMethod<number>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((id) =>
          api.deleteInvoice(id).pipe(
            tapResponse({
              next: () => {
                patchState(store, {
                  invoices: store.invoices().filter((inv) => inv.id !== id),
                  loading: false,
                });
              },
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    loadPayments: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          api.getPayments().pipe(
            tapResponse({
              next: (payments) => patchState(store, { payments, loading: false }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    createPayment: rxMethod<{ dto: any; onSuccess?: () => void }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ dto, onSuccess }) =>
          api.createPayment(dto).pipe(
            tapResponse({
              next: (payment) => {
                patchState(store, {
                  payments: [payment, ...store.payments()],
                  loading: false,
                });
                if (onSuccess) onSuccess();
                (store as any).loadInvoices();
                (store as any).loadJournalEntries();
                (store as any).loadAccounts();
                // Refresh all financial reports so they reflect the new payment
                const year = new Date().getFullYear();
                const startDate = `${year}-01-01`;
                const endDate = `${year}-12-31`;
                if (store.profitLoss()) {
                  (store as any).loadProfitAndLoss({ startDate, endDate, currency: store.profitLoss().currency ?? 'EGP' });
                }
                if (store.balanceSheet()) {
                  (store as any).loadBalanceSheet({ asOfDate: endDate });
                }
                if (store.cashFlow()) {
                  (store as any).loadCashFlow({ startDate, endDate });
                }
              },
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    deletePayment: rxMethod<number>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((id) =>
          api.deletePayment(id).pipe(
            tapResponse({
              next: () => {
                patchState(store, {
                  payments: store.payments().filter((p) => p.id !== id),
                  loading: false,
                });
                (store as any).loadInvoices();
                (store as any).loadJournalEntries();
                (store as any).loadAccounts();
                // Refresh reports
                const year = new Date().getFullYear();
                const startDate = `${year}-01-01`;
                const endDate = `${year}-12-31`;
                if (store.profitLoss()) {
                  (store as any).loadProfitAndLoss({ startDate, endDate, currency: store.profitLoss().currency ?? 'EGP' });
                }
                if (store.balanceSheet()) {
                  (store as any).loadBalanceSheet({ asOfDate: endDate });
                }
                if (store.cashFlow()) {
                  (store as any).loadCashFlow({ startDate, endDate });
                }
              },
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    loadProfitAndLoss: rxMethod<{ startDate: string; endDate: string; currency?: string }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ startDate, endDate, currency }) =>
          api.getProfitAndLoss(startDate, endDate, currency).pipe(
            tapResponse({
              next: (profitLoss) => patchState(store, { profitLoss, loading: false }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    loadBalanceSheet: rxMethod<{ asOfDate: string }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ asOfDate }) =>
          api.getBalanceSheet(asOfDate).pipe(
            tapResponse({
              next: (balanceSheet) => patchState(store, { balanceSheet, loading: false }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),

    loadCashFlow: rxMethod<{ startDate: string; endDate: string }>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(({ startDate, endDate }) =>
          api.getCashFlow(startDate, endDate).pipe(
            tapResponse({
              next: (cashFlow) => patchState(store, { cashFlow, loading: false }),
              error: (error: Error) => patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),
  }))
);
