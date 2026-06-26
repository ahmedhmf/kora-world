import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ContactsStore } from './contacts.store';
import { Contact } from '../core/models/contact.model';

const base = 'http://localhost:3000';
const makeContact = (id: number): Contact => ({ id, name: `Contact ${id}`, type: 'supplier' } as unknown as Contact);

describe('ContactsStore', () => {
  let store: InstanceType<typeof ContactsStore>;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ContactsStore, provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(ContactsStore);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should have empty initial state', () => {
    expect(store.contacts()).toEqual([]);
    expect(store.totalContacts()).toBe(0);
  });

  describe('loadContacts', () => {
    it('populates contacts on success', (() => {
      store.loadContacts();
      httpTesting.expectOne(`${base}/contacts`).flush([makeContact(1), makeContact(2)]);      expect(store.contacts().length).toBe(2);
      expect(store.totalContacts()).toBe(2);
    }));
  });

  describe('createContact', () => {
    it('appends new contact and calls callback', (() => {
      store.loadContacts();
      httpTesting.expectOne(`${base}/contacts`).flush([makeContact(1)]);
      let callbackCalled = false;
      store.createContact({ dto: { name: 'New', type: 'supplier' } as never, callback: () => { callbackCalled = true; } });
      httpTesting.expectOne(`${base}/contacts`).flush(makeContact(2));
      expect(store.contacts().length).toBe(2);
      expect(callbackCalled).toBe(true);
    }));

    it('appends new contact without callback', (() => {
      store.loadContacts();
      httpTesting.expectOne(`${base}/contacts`).flush([makeContact(1)]);
      store.createContact({ dto: { name: 'New' } as never });
      httpTesting.expectOne(`${base}/contacts`).flush(makeContact(2));
      expect(store.contacts().length).toBe(2);
    }));
  });

  describe('updateContact', () => {
    it('replaces matching contact by id and calls callback', (() => {
      store.loadContacts();
      httpTesting.expectOne(`${base}/contacts`).flush([makeContact(1), makeContact(2)]);
      let cbCalled = false;
      const updated = { ...makeContact(1), name: 'Updated' };
      store.updateContact({ id: 1, dto: { name: 'Updated' } as never, callback: () => { cbCalled = true; } });
      httpTesting.expectOne(`${base}/contacts/1`).flush(updated);
      expect(store.contacts()[0].name).toBe('Updated');
      expect(cbCalled).toBe(true);
    }));
  });

  describe('deleteContact', () => {
    it('removes contact by id', (() => {
      store.loadContacts();
      httpTesting.expectOne(`${base}/contacts`).flush([makeContact(1), makeContact(2)]);
      store.deleteContact(1);
      httpTesting.expectOne(`${base}/contacts/1`).flush(null);
      expect(store.contacts().length).toBe(1);
    }));
  });

  describe('selectContact', () => {
    it('sets and clears selectedContact', () => {
      store.selectContact(makeContact(5));
      expect(store.selectedContact()).toBeTruthy();
      store.selectContact(null);
      expect(store.selectedContact()).toBeNull();
    });
  });
});
