import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SupplierEgpPilotService } from './supplier-egp-pilot.service';
import { AccountType } from '../accounting/entities/accounting-account.entity';

describe('SupplierEgpPilotService — disabled-by-default EGP transaction path', () => {
  const env = {
    flag: process.env.SUPPLIER_EGP_PILOT,
    database: process.env.DATABASE_NAME,
    host: process.env.DATABASE_HOST,
  };
  const invoice = {
    id: 7, number: 'SUP-007', type: 'incoming', status: 'sent',
    currency: 'EGP', total: 1000, poId: null,
  };
  const ap = {
    id: 20, code: '2100', type: AccountType.LIABILITY,
    currency: 'EGP', isActive: true,
  };
  const bank = {
    id: 11, code: '1102', type: AccountType.ASSET,
    currency: 'EGP', isActive: true,
  };
  const input = {
    invoiceId: 7, bankAccountId: 11, amountCents: 40_000,
    date: '2026-11-11', requestKey: 'd13a9655-c750-48ec-ac2e-ed6c1868d532',
    description: 'Supplier instalment',
  };
  let state: {
    status: string;
    payments: any[];
    journalEntries: any[];
    savedPayment?: any;
    savedJournal?: any;
    saveInvoice?: any;
    failJournal?: boolean;
  };
  const manager = {
    query: jest.fn(async (sql: string) =>
      sql.includes('current_database') ? [{ database_name: 'kora_test' }] : []),
    findOne: jest.fn(async (type: { name: string }, opts: any) => {
      if (type.name === 'Invoice') return { ...invoice, status: state.status };
      if (type.name === 'Payment') return state.payments.find(p => p.reference === opts.where.reference) || null;
      if (type.name === 'AccountingAccount') {
        if (opts.where.code === '2100') return ap;
        return opts.where.id === 20 ? ap : opts.where.id === 11 ? bank : null;
      }
      if (type.name === 'JournalEntry') {
        return state.journalEntries.find(j => j.sourceEventKey === opts.where.sourceEventKey) || null;
      }
      return null;
    }),
    find: jest.fn(async (type: { name: string }, opts: any) => {
      if (type.name === 'JournalEntry') {
        if (opts.where.type === 'invoice') {
          return [{ id: 1, type: 'invoice', postingStatus: 'posted' }];
        }
        if (opts.where.type === 'payment') {
          return state.journalEntries.filter(j => j.type === 'payment');
        }
      }
      if (type.name === 'Payment') return state.payments;
      return [];
    }),
    exists: jest.fn(async () => false),
    create: jest.fn((_type: unknown, value: any) => value),
    save: jest.fn(async (type: { name: string }, value: any) => {
      if (type.name === 'Payment') {
        state.savedPayment = { ...value, id: 99 };
        return state.savedPayment;
      }
      if (type.name === 'JournalEntry') {
        if (state.failJournal) throw new Error('simulated journal failure');
        state.savedJournal = { ...value, id: 199 };
        return state.savedJournal;
      }
      if (type.name === 'Invoice') {
        state.saveInvoice = { ...value };
        return value;
      }
      return value;
    }),
  };
  const db = {
    transaction: jest.fn(async (_isolation: string, fn: (m: typeof manager) => Promise<unknown>) => fn(manager)),
  };
  const service = new SupplierEgpPilotService(db as unknown as DataSource);

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPPLIER_EGP_PILOT = 'true';
    process.env.DATABASE_NAME = 'kora_test';
    process.env.DATABASE_HOST = '127.0.0.1';
    state = { status: 'sent', payments: [], journalEntries: [] };
  });
  afterAll(() => {
    if (env.flag === undefined) delete process.env.SUPPLIER_EGP_PILOT;
    else process.env.SUPPLIER_EGP_PILOT = env.flag;
    if (env.database === undefined) delete process.env.DATABASE_NAME;
    else process.env.DATABASE_NAME = env.database;
    if (env.host === undefined) delete process.env.DATABASE_HOST;
    else process.env.DATABASE_HOST = env.host;
  });

  it('rejects when pilot flag is off without opening a transaction', async () => {
    delete process.env.SUPPLIER_EGP_PILOT;
    await expect(service.create(input)).rejects.toThrow(ForbiddenException);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('rejects when the configured database is not kora_test', async () => {
    process.env.DATABASE_NAME = 'kora_world';
    await expect(service.create(input)).rejects.toThrow(ForbiddenException);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('rejects when the actual database identity disagrees', async () => {
    manager.query.mockResolvedValueOnce([{ database_name: 'kora_world' }]);
    await expect(service.create(input)).rejects.toThrow(ForbiddenException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('saves one payment and one balanced AP/bank journal and updates invoice status inside transaction', async () => {
    const result = await service.create(input);
    expect(db.transaction).toHaveBeenCalledWith('SERIALIZABLE', expect.any(Function));
    expect(result).toEqual({
      paymentId: 99, journalId: 199,
      status: 'partially_paid', remainingCents: 60_000, replayed: false,
    });
    expect(state.savedPayment.reference).toBe('SEGP-' + input.requestKey);
    expect(state.savedJournal.sourceEventKey).toBe('supplier-payment:99:posted:v1');
    expect(state.savedJournal.lines.map((l: any) => ({
      accountId: l.accountId, debit: l.debit, credit: l.credit,
    }))).toEqual([
      { accountId: 20, debit: 400, credit: 0 },
      { accountId: 11, debit: 0, credit: 400 },
    ]);
    expect(state.saveInvoice.status).toBe('partially_paid');
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock'),
      expect.arrayContaining([expect.any(Number), expect.stringContaining(input.requestKey)]),
    );
  });

  it('recognizes an idempotent retry and returns the original journal instead of writing', async () => {
    state.status = 'paid';
    state.payments = [{
      id: 90, invoiceId: 7, paidFromAccountId: 11,
      amount: 400, date: '2026-11-11', reference: 'SEGP-' + input.requestKey,
    }];
    state.journalEntries = [{
      id: 190, type: 'payment', sourceEventKey: 'supplier-payment:90:posted:v1',
      postingStatus: 'posted',
    }];
    const result = await service.create(input);
    expect(result.replayed).toBe(true);
    expect(result.paymentId).toBe(90);
    expect(result.journalId).toBe(190);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('refuses conflicting reuse of a request key', async () => {
    state.payments = [{
      id: 90, invoiceId: 7, paidFromAccountId: 11,
      amount: 200, date: '2026-11-11', reference: 'SEGP-' + input.requestKey,
    }];
    await expect(service.create(input)).rejects.toThrow(ConflictException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects an overpayment before creating a payment', async () => {
    await expect(service.create({ ...input, amountCents: 100_001 }))
      .rejects.toThrow(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects missing or ambiguous invoice-booking journals', async () => {
    manager.find.mockResolvedValueOnce([]);
    await expect(service.create(input)).rejects.toThrow(ConflictException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('refuses invoices with legacy payment records instead of silently reposting', async () => {
    state.payments = [{
      id: 88, invoiceId: 7, amount: 100, currency: 'EGP',
      exchangeRate: 1, reference: 'LEGACY-88',
    }];
    await expect(service.create(input)).rejects.toThrow(ConflictException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('propagates journal failure so the real transaction manager can roll back', async () => {
    state.failJournal = true;
    await expect(service.create(input)).rejects.toThrow('simulated journal failure');
    expect(state.saveInvoice).toBeUndefined();
  });
});
