import { inject } from '@angular/core';
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap } from 'rxjs';
import { ApiService } from '../core/services/api.service';
import { tapResponse } from '@ngrx/operators';

export interface SourcingQuery {
  sport: 'football' | 'handball';
  tier: 'match_pro' | 'competition' | 'training' | 'club';
  certifications?: string[];
  targetMarket?: string;
  budgetPerUnit?: string;
  moqMax?: number;
  notes?: string;
}

export interface SupplierResult {
  name: string;
  country: string;
  tierFit: string;
  coverMaterial: string;
  bladder: string;
  stitching: string;
  certifications: string[];
  estimatedMoq: string;
  estimatedFobPrice: string;
  paymentMethods: string[];
  contactInfo: string;
  notes: string;
  score: number;
}

export interface SourcingResult {
  suppliers: SupplierResult[];
  recommended: string;
  reasoning: string;
  contactEmailDraft: string;
}

interface SourcingState {
  query: SourcingQuery | null;
  result: SourcingResult | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
}

const initialState: SourcingState = {
  query: null,
  result: null,
  status: 'idle',
  error: null,
};

export const SourcingStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(ApiService)) => ({
    runResearch: rxMethod<SourcingQuery>(
      pipe(
        tap((query) => patchState(store, { query, status: 'loading', error: null, result: null })),
        switchMap((query) =>
          api.runSourcingResearch(query).pipe(
            tapResponse({
              next: (result: SourcingResult) => {
                patchState(store, { result, status: 'success', error: null });
              },
              error: (error: any) => {
                const errMsg = error.error?.message || error.message || 'Sourcing research failed';
                patchState(store, { error: errMsg, status: 'error' });
              },
            })
          )
        )
      )
    ),
    reset: () => {
      patchState(store, initialState);
    },
  }))
);
