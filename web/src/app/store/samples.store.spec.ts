import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SamplesStore } from './samples.store';
import { Sample } from '../core/models/sample.model';

const base = 'http://localhost:3000';
const makeSample = (id: number): Sample => ({ id, name: `Sample ${id}` } as unknown as Sample);

describe('SamplesStore', () => {
  let store: InstanceType<typeof SamplesStore>;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SamplesStore, provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(SamplesStore);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should have empty initial state', () => {
    expect(store.samples()).toEqual([]);
    expect(store.totalSamples()).toBe(0);
  });

  describe('loadSamples', () => {
    it('populates samples on success', (() => {
      store.loadSamples();
      httpTesting.expectOne(`${base}/samples`).flush([makeSample(1), makeSample(2)]);      expect(store.samples().length).toBe(2);
      expect(store.totalSamples()).toBe(2);
    }));

    it('sets error on failure', (() => {
      store.loadSamples();
      httpTesting.expectOne(`${base}/samples`).error(new ErrorEvent('fail'));      expect(store.error()).toBeTruthy();
    }));
  });

  describe('createSample', () => {
    it('prepends the new sample', (() => {
      store.loadSamples();
      httpTesting.expectOne(`${base}/samples`).flush([makeSample(1)]);
      store.createSample({ name: 'New' } as never);
      httpTesting.expectOne(`${base}/samples`).flush(makeSample(2));
      expect(store.samples()[0].id).toBe(2);
    }));
  });

  describe('updateSample', () => {
    it('replaces matching sample by id', (() => {
      store.loadSamples();
      httpTesting.expectOne(`${base}/samples`).flush([makeSample(1), makeSample(2)]);
      const updated = { ...makeSample(1), name: 'Updated' };
      store.updateSample({ id: 1, dto: { name: 'Updated' } });
      httpTesting.expectOne(`${base}/samples/1`).flush(updated);
      expect(store.samples()[0].name).toBe('Updated');
    }));
  });

  describe('deleteSample', () => {
    it('removes sample by id', (() => {
      store.loadSamples();
      httpTesting.expectOne(`${base}/samples`).flush([makeSample(1), makeSample(2)]);
      store.deleteSample(1);
      httpTesting.expectOne(`${base}/samples/1`).flush(null);
      expect(store.samples().length).toBe(1);
      expect(store.samples()[0].id).toBe(2);
    }));
  });

  describe('selectSample', () => {
    it('sets and clears selectedSample', () => {
      const s = makeSample(5);
      store.selectSample(s);
      expect(store.selectedSample()).toEqual(s);
      store.selectSample(null);
      expect(store.selectedSample()).toBeNull();
    });
  });
});
