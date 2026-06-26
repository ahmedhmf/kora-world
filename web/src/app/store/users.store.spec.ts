import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UsersStore } from './users.store';
import { User } from '../core/models/user.model';

const base = 'http://localhost:3000';
const makeUser = (id: number): User => ({ id, name: `User ${id}`, email: `u${id}@t.com`, role: 'employee' } as unknown as User);

describe('UsersStore', () => {
  let store: InstanceType<typeof UsersStore>;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [UsersStore, provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(UsersStore);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should have empty initial state', () => {
    expect(store.users()).toEqual([]);
    expect(store.totalUsers()).toBe(0);
  });

  describe('loadUsers', () => {
    it('populates users on success', (() => {
      store.loadUsers();
      httpTesting.expectOne(`${base}/users`).flush([makeUser(1), makeUser(2)]);      expect(store.users().length).toBe(2);
      expect(store.totalUsers()).toBe(2);
    }));

    it('sets error on failure', (() => {
      store.loadUsers();
      httpTesting.expectOne(`${base}/users`).error(new ErrorEvent('fail'));      expect(store.error()).toBeTruthy();
    }));
  });

  describe('createUser', () => {
    it('appends the new user on success', (() => {
      store.loadUsers();
      httpTesting.expectOne(`${base}/users`).flush([makeUser(1)]);
      store.createUser({ name: 'New', email: 'n@t.com', role: 'employee', password: 'p' });
      httpTesting.expectOne(`${base}/users`).flush(makeUser(2));
      expect(store.users().length).toBe(2);
      expect(store.users()[1].id).toBe(2);
    }));
  });

  describe('updateUser', () => {
    it('replaces matching user by id', (() => {
      store.loadUsers();
      httpTesting.expectOne(`${base}/users`).flush([makeUser(1), makeUser(2)]);
      const updated = { ...makeUser(1), name: 'Updated' };
      store.updateUser({ id: 1, dto: { name: 'Updated' } });
      httpTesting.expectOne(`${base}/users/1`).flush(updated);
      expect(store.users()[0].name).toBe('Updated');
    }));
  });

  describe('deleteUser', () => {
    it('removes user by id', (() => {
      store.loadUsers();
      httpTesting.expectOne(`${base}/users`).flush([makeUser(1), makeUser(2)]);
      store.deleteUser(1);
      httpTesting.expectOne(`${base}/users/1`).flush(null);
      expect(store.users().length).toBe(1);
      expect(store.users()[0].id).toBe(2);
    }));
  });

  describe('selectUser', () => {
    it('sets and clears selectedUser', () => {
      const u = makeUser(3);
      store.selectUser(u);
      expect(store.selectedUser()).toEqual(u);
      store.selectUser(null);
      expect(store.selectedUser()).toBeNull();
    });
  });
});
