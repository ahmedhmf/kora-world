import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EventsStore } from './events.store';
import { CalendarEvent } from '../core/models/event.model';

const base = 'http://localhost:3000';
const makeEvent = (id: number): CalendarEvent =>
  ({ id, title: `Event ${id}`, startDate: '2026-01-01', endDate: '2026-01-02' } as unknown as CalendarEvent);

describe('EventsStore', () => {
  let store: InstanceType<typeof EventsStore>;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [EventsStore, provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(EventsStore);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should have empty initial state', () => {
    expect(store.events()).toEqual([]);
    expect(store.totalEvents()).toBe(0);
  });

  describe('loadEvents', () => {
    it('populates events on success', (() => {
      store.loadEvents();
      httpTesting.expectOne(`${base}/events`).flush([makeEvent(1), makeEvent(2)]);      expect(store.events().length).toBe(2);
      expect(store.totalEvents()).toBe(2);
    }));

    it('sets error on failure', (() => {
      store.loadEvents();
      httpTesting.expectOne(`${base}/events`).error(new ErrorEvent('fail'));      expect(store.error()).toBeTruthy();
    }));
  });

  describe('createEvent', () => {
    it('appends new event on success', (() => {
      store.loadEvents();
      httpTesting.expectOne(`${base}/events`).flush([makeEvent(1)]);
      store.createEvent({ title: 'New', category: 'trade_show', startDate: '2026-02-01', endDate: '2026-02-02' });
      httpTesting.expectOne(`${base}/events`).flush(makeEvent(2));
      expect(store.events().length).toBe(2);
    }));
  });

  describe('updateEvent', () => {
    it('replaces matching event by id', (() => {
      store.loadEvents();
      httpTesting.expectOne(`${base}/events`).flush([makeEvent(1), makeEvent(2)]);
      const updated = { ...makeEvent(1), title: 'Updated' };
      store.updateEvent({ id: 1, dto: { title: 'Updated' } });
      httpTesting.expectOne(`${base}/events/1`).flush(updated);
      expect(store.events()[0].title).toBe('Updated');
    }));
  });

  describe('deleteEvent', () => {
    it('removes event by id', (() => {
      store.loadEvents();
      httpTesting.expectOne(`${base}/events`).flush([makeEvent(1), makeEvent(2)]);
      store.deleteEvent(1);
      httpTesting.expectOne(`${base}/events/1`).flush(null);
      expect(store.events().length).toBe(1);
      expect(store.events()[0].id).toBe(2);
    }));
  });

  describe('selectEvent', () => {
    it('sets and clears selectedEvent', () => {
      store.selectEvent(makeEvent(3));
      expect(store.selectedEvent()?.id).toBe(3);
      store.selectEvent(null);
      expect(store.selectedEvent()).toBeNull();
    });
  });
});
