import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ControlledSupplierInvoiceBookingService } from './controlled-supplier-invoice-booking.service';
import { Invoice, InvoiceStatus, InvoiceType } from './entities/invoice.entity';
import { InvoiceLine } from './entities/invoice-line.entity';
import { Payment } from '../payments/entities/payment.entity';
import { AccountingAccount, AccountType } from '../accounting/entities/accounting-account.entity';
import { JournalEntry, JournalEntryType } from '../accounting/entities/journal-entry.entity';
import { JournalLine } from '../accounting/entities/journal-line.entity';
import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';
import { PurchaseOrderLineItem } from '../purchase-orders/entities/purchase-order-line-item.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { SupplierContact } from '../suppliers/entities/supplier-contact.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * PostgreSQL integration, strictly on disposable kora_test.
 * No AppModule, migrations, sync, or production access.
 * All cleanup is confined to the invoice fixture allocated in each test.
 */
describe('Controlled EGP supplier invoice booking (local PostgreSQL)', () => {
  let db: DataSource;
  let service: ControlledSupplierInvoiceBookingService;
  let invoiceId = 0;
  let expenseId: number;
  let apId: number;
  const prior = {
    pilot: process.env.SUPPLIER_EGP_PILOT,
    booking: process.env.CONTROLLED_INVOICE_BOOKING,
  };

  async function assertNoPosting() {
    expect(await db.getRepository(JournalEntry).countBy({ invoiceId })).toBe(0);
    const invoice = await db.getRepository(Invoice).findOneByOrFail({ id: invoiceId });
    expect(invoice.status).toBe(InvoiceStatus.DRAFT);
  }

  beforeAll(async () => {
    if (process.env.DATABASE_NAME !== 'kora_test' ||
        !['localhost', '127.0.0.1', '::1'].includes(process.env.DATABASE_HOST || '127.0.0.1')) {
      throw new Error('REFUSING controlled booking integration tests: set DATABASE_NAME=kora_test on loopback host');
    }
    const username = process.env.DATABASE_USER || process.env.DB_USER;
    const password = process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD;
    if (!username || !password) throw new Error('Missing disposable local PostgreSQL credentials');

    db = new DataSource({
      type: 'postgres',
      host: process.env.DATABASE_HOST || '127.0.0.1',
      port: Number(process.env.DATABASE_PORT || 5432),
      database: 'kora_test',
      username,
      password,
      entities: [
        AccountingAccount, JournalEntry, JournalLine, Invoice, InvoiceLine,
        Payment, PurchaseOrder, PurchaseOrderLineItem, Supplier, SupplierContact,
        Product, User,
      ],
      synchronize: false, migrationsRun: false, logging: false,
    });
    await db.initialize();
    const [identity] = await db.query('SELECT current_database() AS database_name');
    if (identity?.database_name !== 'kora_test') {
      await db.destroy();
      throw new Error('REFUSING: actual connected database is not kora_test');
    }

    for (const [code, type] of [
      ['5100', AccountType.EXPENSE], ['2100', AccountType.LIABILITY],
    ] as const) {
      const account = await db.getRepository(AccountingAccount).findOneBy({ code });
      if (!account || account.type !== type || account.currency !== 'EGP' ||
          !account.isActive || await db.getRepository(AccountingAccount).existsBy({ parentId: account.id })) {
        throw new Error(`Prerequisite: ${code} must be an active leaf EGP ${type} account on disposable kora_test`);
      }
      if (code === '5100') expenseId = account.id;
      if (code === '2100') apId = account.id;
    }

    process.env.SUPPLIER_EGP_PILOT = 'true';
    process.env.CONTROLLED_INVOICE_BOOKING = 'true';
    service = new ControlledSupplierInvoiceBookingService(db);
  });

  beforeEach(async () => {
    const tag = randomUUID().replace(/-/g, '').slice(0, 20);
    const repo = db.getRepository(Invoice);
    const invoice = await repo.save(repo.create({
      number: `IT-BOOK-${tag}`,
      type: InvoiceType.INCOMING, status: InvoiceStatus.DRAFT,
      currency: 'EGP', total: 1000, subtotal: 1000, tax: 0,
      date: '2026-11-11', dueDate: '2026-12-11', lines: [],
    }));
    invoiceId = invoice.id;
  });

  afterEach(async () => {
    if (!db?.isInitialized || !invoiceId) return;
    // Never delete unrelated rows, even when a test fails.
    await db.getRepository(JournalEntry).delete({ invoiceId });
    await db.getRepository(Payment).delete({ invoiceId });
    await db.getRepository(Invoice).delete({ id: invoiceId });
    invoiceId = 0;
  });

  afterAll(async () => {
    if (prior.pilot === undefined) delete process.env.SUPPLIER_EGP_PILOT;
    else process.env.SUPPLIER_EGP_PILOT = prior.pilot;
    if (prior.booking === undefined) delete process.env.CONTROLLED_INVOICE_BOOKING;
    else process.env.CONTROLLED_INVOICE_BOOKING = prior.booking;
    if (db?.isInitialized) await db.destroy();
  });

  it('posts exactly one balanced invoice journal and SENT status atomically', async () => {
    const response = await service.post(invoiceId);
    expect(response).toEqual({
      invoiceId, journalId: expect.any(Number), status: 'sent', replayed: false,
    });
    const invoice = await db.getRepository(Invoice).findOneByOrFail({ id: invoiceId });
    expect(invoice.status).toBe(InvoiceStatus.SENT);
    const entries = await db.getRepository(JournalEntry).find({
      where: { invoiceId }, relations: { lines: true },
    });
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry.id).toBe(response.journalId);
    expect(entry.type).toBe(JournalEntryType.INVOICE);
    expect(entry.sourceEventKey).toBe(`supplier-invoice:${invoiceId}:booked:v1`);
    expect(entry.postingStatus).toBe('posted');
    expect(entry.lines).toHaveLength(2);
    expect(entry.lines.find(line => line.accountId === expenseId)?.debit).toBe(1000);
    expect(entry.lines.find(line => line.accountId === apId)?.credit).toBe(1000);
    expect(entry.lines.reduce((sum, line) => sum + Number(line.debit), 0)).toBe(1000);
    expect(entry.lines.reduce((sum, line) => sum + Number(line.credit), 0)).toBe(1000);
    expect(await db.getRepository(Payment).countBy({ invoiceId })).toBe(0);
    expect(await db.getRepository(JournalEntry).countBy({
      invoiceId, type: JournalEntryType.PAYMENT,
    })).toBe(0);
  });

  it('replays the verified booking without creating a second journal', async () => {
    const first = await service.post(invoiceId);
    const second = await service.post(invoiceId);
    expect(second).toEqual({ ...first, replayed: true });
    expect(await db.getRepository(JournalEntry).countBy({ invoiceId })).toBe(1);
    expect(await db.getRepository(Payment).countBy({ invoiceId })).toBe(0);
  });

  it('handles simultaneous calls without double-booking', async () => {
    const responses = await Promise.allSettled([service.post(invoiceId), service.post(invoiceId)]);
    expect(responses.some(result => result.status === 'fulfilled')).toBe(true);
    // A serialization conflict may reject one concurrent attempt. Once settled,
    // retry must resolve to the same verified journal.
    const later = await service.post(invoiceId);
    expect(later.replayed).toBe(true);
    const entries = await db.getRepository(JournalEntry).findBy({ invoiceId });
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe(later.journalId);
    expect(await db.getRepository(Payment).countBy({ invoiceId })).toBe(0);
  });

  it('rejects historical booking journals rather than rewriting them', async () => {
    const entry = db.getRepository(JournalEntry).create({
      type: JournalEntryType.INVOICE, invoiceId, date: '2026-11-11',
      description: 'Preexisting fixture journal', postingStatus: 'posted',
    });
    await db.getRepository(JournalEntry).save(entry);
    await expect(service.post(invoiceId)).rejects.toThrow(ConflictException);
    expect(await db.getRepository(JournalEntry).countBy({ invoiceId })).toBe(1);
    expect((await db.getRepository(Invoice).findOneByOrFail({ id: invoiceId })).status)
      .toBe(InvoiceStatus.DRAFT);
  });

  it('rejects inconsistent totals without creating a journal', async () => {
    await db.getRepository(Invoice).update({ id: invoiceId }, { total: 999 });
    await expect(service.post(invoiceId)).rejects.toThrow(ConflictException);
    await assertNoPosting();
  });

  it('rejects foreign-currency invoices and leaves their manually entered values alone', async () => {
    await db.getRepository(Invoice).update({ id: invoiceId }, { currency: 'EUR' });
    await expect(service.post(invoiceId)).rejects.toThrow();
    await assertNoPosting();
    expect((await db.getRepository(Invoice).findOneByOrFail({ id: invoiceId })).currency)
      .toBe('EUR');
  });

  it('fails closed when the controlled-booking feature flag is disabled', async () => {
    process.env.CONTROLLED_INVOICE_BOOKING = 'false';
    try {
      await expect(service.post(invoiceId)).rejects.toThrow(ForbiddenException);
      await assertNoPosting();
    } finally {
      process.env.CONTROLLED_INVOICE_BOOKING = 'true';
    }
  });

  it('rolls back the journal insert if invoice status persistence fails', async () => {
    // Inject a failure after the journal INSERT, within the real DB transaction.
    // Proxy only the transaction-scoped EntityManager, never the repository or
    // DataSource globally. PostgreSQL rolls the journal back as well.
    const simulatedDb = {
      transaction: (isolation: 'SERIALIZABLE', work: (m: EntityManager) => Promise<unknown>) =>
        db.transaction(isolation, async m => {
          const wrapped = new Proxy(m, {
            get(target, property, receiver) {
              if (property === 'save') {
                return async (entity: unknown, value: unknown) => {
                  if (entity === Invoice) {
                    throw new Error('TEST ONLY: failed invoice status persistence');
                  }
                  return m.save(entity as typeof JournalEntry, value as JournalEntry);
                };
              }
              const v: unknown = Reflect.get(target, property, receiver);
              return typeof v === 'function' ? v.bind(target) : v;
            },
          });
          return work(wrapped);
        }),
    } as DataSource;
    const failing = new ControlledSupplierInvoiceBookingService(simulatedDb);
    await expect(failing.post(invoiceId))
      .rejects.toThrow('TEST ONLY: failed invoice status persistence');
    await assertNoPosting();
  });
});
