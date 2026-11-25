import { DataSource } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { InvoicePaymentReconciliationService } from './invoice-payment-reconciliation.service';

describe('InvoicePaymentReconciliationService', () => {
  const old = {
    flag: process.env.ACCOUNTING_RECONCILIATION_AUDIT,
    name: process.env.DATABASE_NAME,
    host: process.env.DATABASE_HOST,
  };
  const manager = {
    query: jest.fn(async () => [{name: 'kora_test'}]),
    find: jest.fn(async () => []),
  };
  const db = {
    transaction: jest.fn(async (_isolation: string, callback: (m: typeof manager) => Promise<unknown>) =>
      callback(manager)),
  };
  const service = new InvoicePaymentReconciliationService(db as unknown as DataSource);
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ACCOUNTING_RECONCILIATION_AUDIT = 'true';
    process.env.DATABASE_NAME = 'kora_test';
    process.env.DATABASE_HOST = '127.0.0.1';
    manager.query.mockResolvedValue([{name: 'kora_test'}]);
    manager.find.mockResolvedValue([]);
  });
  afterAll(() => {
    if (old.flag === undefined) delete process.env.ACCOUNTING_RECONCILIATION_AUDIT;
    else process.env.ACCOUNTING_RECONCILIATION_AUDIT = old.flag;
    if (old.name === undefined) delete process.env.DATABASE_NAME;
    else process.env.DATABASE_NAME = old.name;
    if (old.host === undefined) delete process.env.DATABASE_HOST;
    else process.env.DATABASE_HOST = old.host;
  });

  it('refuses access before opening a DB transaction when flag is unset', async () => {
    delete process.env.ACCOUNTING_RECONCILIATION_AUDIT;
    await expect(service.audit()).rejects.toThrow(ForbiddenException);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('refuses a non-test configured database', async () => {
    process.env.DATABASE_NAME = 'kora_world';
    await expect(service.audit()).rejects.toThrow(ForbiddenException);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('refuses when current_database reports anything except kora_test', async () => {
    manager.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{name: 'kora_world'}]);
    await expect(service.audit()).rejects.toThrow(ForbiddenException);
    expect(manager.find).not.toHaveBeenCalled();
  });

  it('reports payment journals without invoice linkage for manual investigation', async () => {
    manager.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 2, invoiceId: null }])
      .mockResolvedValueOnce([{ id: 4, invoiceId: null, type: 'payment' }]);
    const audit = await service.audit();
    expect(audit.unassignedPayments).toEqual([2]);
    expect(audit.unassignedJournals).toEqual([4]);
  });

  it('uses repeatable-read, read-only snapshot with no writes', async () => {
    const audit = await service.audit();
    expect(db.transaction).toHaveBeenCalledWith('REPEATABLE READ', expect.any(Function));
    expect(manager.query).toHaveBeenCalledWith('SET TRANSACTION READ ONLY');
    expect(manager.query).toHaveBeenCalledWith('SELECT current_database() AS name');
    expect(audit).toEqual({
      scope: 'local-kora-test', totalInvoices: 0, flaggedInvoices: 0,
      unassignedPayments: [], unassignedJournals: [], invoices: [],
    });
  });
});
