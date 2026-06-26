import { TestBed } from '@angular/core/testing';
import { DialogService } from './dialog.service';

describe('DialogService', () => {
  let service: DialogService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DialogService] });
    service = TestBed.inject(DialogService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with isOpen: false', () => {
    expect(service.state().isOpen).toBe(false);
  });

  // ─── confirm ──────────────────────────────────────────────────────────────

  describe('confirm', () => {
    it('should open dialog with isConfirm: true and return a Promise', () => {
      const promise = service.confirm('Delete item', 'Are you sure?');
      const state = service.state();

      expect(state.isOpen).toBe(true);
      expect(state.isConfirm).toBe(true);
      expect(state.title).toBe('Delete item');
      expect(state.message).toBe('Are you sure?');
      expect(promise).toBeInstanceOf(Promise);
    });
  });

  // ─── alert ────────────────────────────────────────────────────────────────

  describe('alert', () => {
    it('should open dialog with isConfirm: false', () => {
      service.alert('Notice', 'Something happened');
      const state = service.state();

      expect(state.isOpen).toBe(true);
      expect(state.isConfirm).toBe(false);
      expect(state.title).toBe('Notice');
      expect(state.message).toBe('Something happened');
    });
  });

  // ─── yes ──────────────────────────────────────────────────────────────────

  describe('yes', () => {
    it('should resolve the promise with true and close the dialog', async () => {
      const promise = service.confirm('Q', 'Continue?');
      service.yes();

      const result = await promise;
      expect(result).toBe(true);
      expect(service.state().isOpen).toBe(false);
    });
  });

  // ─── no ───────────────────────────────────────────────────────────────────

  describe('no', () => {
    it('should resolve the promise with false and close the dialog', async () => {
      const promise = service.confirm('Q', 'Delete?');
      service.no();

      const result = await promise;
      expect(result).toBe(false);
      expect(service.state().isOpen).toBe(false);
    });
  });

  // ─── close ────────────────────────────────────────────────────────────────

  describe('close', () => {
    it('should set isOpen to false without resolving', () => {
      service.alert('Info', 'Just info');
      expect(service.state().isOpen).toBe(true);

      service.close();
      expect(service.state().isOpen).toBe(false);
    });
  });

  // ─── yes/no without open dialog ───────────────────────────────────────────

  describe('yes/no without active dialog', () => {
    it('should not throw when yes() is called with no resolve fn', () => {
      expect(() => service.yes()).not.toThrow();
    });

    it('should not throw when no() is called with no resolve fn', () => {
      expect(() => service.no()).not.toThrow();
    });
  });
});
