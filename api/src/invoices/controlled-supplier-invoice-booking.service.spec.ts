import { ConflictException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ControlledSupplierInvoiceBookingService } from './controlled-supplier-invoice-booking.service';
import { Invoice, InvoiceStatus, InvoiceType } from './entities/invoice.entity';
import { Payment } from '../payments/entities/payment.entity';
import { JournalEntry, JournalEntryType } from '../accounting/entities/journal-entry.entity';
import { AccountingAccount, AccountType } from '../accounting/entities/accounting-account.entity';

describe('ControlledSupplierInvoiceBookingService', () => {
  const original = {
    flag: process.env.CONTROLLED_INVOICE_BOOKING,
    pilot: process.env.SUPPLIER_EGP_PILOT,
    name: process.env.DATABASE_NAME,
    host: process.env.DATABASE_HOST,
  };
  const draft = () => ({
    id: 7, number: 'SUP-7', type: InvoiceType.INCOMING,
    currency: 'EGP', status: InvoiceStatus.DRAFT,
    subtotal: 90, tax: 10, total: 100,
    date: '2026-11-11', poId: null,
  });
  let invoice = draft();
  let journalId = 30;
  const manager = {
    query: jest.fn(async () => [{ database_name: 'kora_test' }]),
    findOne: jest.fn(async (entity: unknown, options: { where: { code?: string } }) => {
      if (entity === Invoice) return invoice;
      if (entity === AccountingAccount) {
        const code = options.where.code;
        return {
          id: code === '5100' ? 51 : code === '2200' ? 22 : 21,
          code, currency: 'EGP', isActive: true,
          type: code === '5100' ? AccountType.EXPENSE : AccountType.LIABILITY,
        };
      }
      return null;
    }),
    exists: jest.fn(async () => false),
    find: jest.fn(async () => []),
    create: jest.fn((_entity: unknown, data: unknown) => data),
    save: jest.fn(async (entity: unknown, value: Record<string, unknown>) => {
      if (entity === JournalEntry) return { ...value, id: journalId };
      if (entity === Invoice) invoice = value as typeof invoice;
      return value;
    }),
  };
  const db = {
    transaction: jest.fn(async (_level: string, cb: (m: typeof manager) => Promise<unknown>) =>
      cb(manager)),
  };
  const service = new ControlledSupplierInvoiceBookingService(db as unknown as DataSource);

  beforeEach(() => {
    jest.clearAllMocks();
    invoice = draft();
    journalId = 30;
    process.env.CONTROLLED_INVOICE_BOOKING = 'true';
    process.env.SUPPLIER_EGP_PILOT = 'true';
    process.env.DATABASE_NAME = 'kora_test';
    process.env.DATABASE_HOST = '127.0.0.1';
    manager.query.mockResolvedValue([{database_name: 'kora_test'}]);
    manager.find.mockResolvedValue([]);
  });
  afterAll(() => {
    for (const [key, value] of Object.entries({
      CONTROLLED_INVOICE_BOOKING: original.flag,
      SUPPLIER_EGP_PILOT: original.pilot,
      DATABASE_NAME: original.name,
      DATABASE_HOST: original.host,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('refuses an unenabled feature before accessing the database', async () => {
    delete process.env.CONTROLLED_INVOICE_BOOKING;
    await expect(service.post(7)).rejects.toThrow(ForbiddenException);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('rejects actual non-test DB identity inside transaction', async () => {
    manager.query.mockResolvedValue([{ database_name: 'kora_world' }]);
    await expect(service.post(7)).rejects.toThrow(ForbiddenException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('posts one balanced journal and status in a single serializable transaction', async () => {
    const result = await service.post(7);
    expect(result).toEqual({ invoiceId: 7, journalId: 30, status: 'sent', replayed: false });
    expect(db.transaction).toHaveBeenCalledWith('SERIALIZABLE', expect.any(Function));
    expect(manager.findOne).toHaveBeenCalledWith(Invoice, {
      where: { id: 7 }, lock: { mode: 'pessimistic_write' },
    });
    const journalSave = manager.save.mock.calls.find(([entity]) => entity === JournalEntry);
    expect(journalSave).toBeDefined();
    const lines = (journalSave![1] as { lines: Array<{ debit: number; credit: number }> }).lines;
    expect(lines.reduce((sum, l) => sum + l.debit, 0)).toBe(100);
    expect(lines.reduce((sum, l) => sum + l.credit, 0)).toBe(100);
    expect(journalSave![1]).toEqual(expect.objectContaining({
      sourceEventKey: 'supplier-invoice:7:booked:v1',
      type: JournalEntryType.INVOICE,
    }));
    expect(invoice.status).toBe(InvoiceStatus.SENT);
    expect(manager.save).toHaveBeenCalledTimes(2);
  });

  it('returns a verified replay without writing', async () => {
    invoice.status = InvoiceStatus.SENT;
    manager.find.mockImplementation(async (entity: unknown) => entity === JournalEntry
      ? [{ id: 41, type: JournalEntryType.INVOICE,
           sourceEventKey: 'supplier-invoice:7:booked:v1',
           postingStatus: 'posted', reversalOfId: null }]
      : []);
    const result = await service.post(7);
    expect(result).toEqual({ invoiceId: 7, journalId: 41, status: 'sent', replayed: true });
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('refuses ambiguous preexisting journals or payments without writes', async () => {
    manager.find.mockImplementation(async (entity: unknown) => entity === Payment
      ? [{ id: 3 }] : []);
    await expect(service.post(7)).rejects.toThrow(ConflictException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('refuses mismatched invoice totals before posting', async () => {
    invoice.total = 101;
    await expect(service.post(7)).rejects.toThrow('Invoice total must equal');
    expect(manager.save).not.toHaveBeenCalled();
  });
});
