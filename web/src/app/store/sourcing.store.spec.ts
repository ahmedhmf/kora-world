import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SourcingStore } from './sourcing.store';
import { ApiService } from '../core/services/api.service';

describe('SourcingStore', () => {
  let store: InstanceType<typeof SourcingStore>;
  let apiMock: any;

  beforeEach(() => {
    apiMock = {
      runSourcingResearch: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        SourcingStore,
        { provide: ApiService, useValue: apiMock },
      ],
    });
    store = TestBed.inject(SourcingStore);
  });

  it('should have initial state', () => {
    expect(store.query()).toBeNull();
    expect(store.result()).toBeNull();
    expect(store.status()).toBe('idle');
    expect(store.error()).toBeNull();
  });

  describe('runResearch', () => {
    it('sets status to success on API success', () => {
      const mockResult = {
        suppliers: [],
        recommended: 'Rec',
        reasoning: 'Reason',
        contactEmailDraft: 'Draft',
      };
      apiMock.runSourcingResearch.mockReturnValue(of(mockResult));

      store.runResearch({ sport: 'football', tier: 'match_pro' });

      expect(store.status()).toBe('success');
      expect(store.result()).toEqual(mockResult);
      expect(store.error()).toBeNull();
    });

    it('sets status to error on API failure', () => {
      apiMock.runSourcingResearch.mockReturnValue(
        throwError(() => ({ error: { message: 'Network Error' } }))
      );

      store.runResearch({ sport: 'football', tier: 'match_pro' });

      expect(store.status()).toBe('error');
      expect(store.error()).toBe('Network Error');
    });
  });

  describe('reset', () => {
    it('clears state to initial values', () => {
      store.reset();
      expect(store.status()).toBe('idle');
    });
  });
});
