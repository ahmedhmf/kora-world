import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { SupplierEgpPilotService } from './supplier-egp-pilot.service';
import { AccountingAccount, AccountType } from '../accounting/entities/accounting-account.entity';
import { JournalEntry, JournalEntryType } from '../accounting/entities/journal-entry.entity';
import { JournalLine } from '../accounting/entities/journal-line.entity';
import { Invoice, InvoiceStatus, InvoiceType } from '../invoices/entities/invoice.entity';
import { InvoiceLine } from '../invoices/entities/invoice-line.entity';
import { Payment } from './entities/payment.entity';
import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';
import { PurchaseOrderLineItem } from '../purchase-orders/entities/purchase-order-line-item.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { SupplierContact } from '../suppliers/entities/supplier-contact.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Real DB pilot checks. ALWAYS local kora_test, no Nest AppModule, no migrations,
 * no schema synchronization. Fixture rows are removed after each test.
 * Do not run against a database containing any real financial records.
 */
describe('Supplier EGP pilot (local PostgreSQL integration)', () => {
  let db: DataSource;
  let service: SupplierEgpPilotService;
  let apId: number;
  let bankId: number;
  let expenseId: number;
  let invoiceId: number;
  let bookingId: number;
  let accountantId: number;
  let employeeId: number;
  const priorEnv = process.env.SUPPLIER_EGP_PILOT;

  const args = (requestKey = randomUUID(), amountCents = 40000) => ({
    invoiceId,
    bankAccountId: bankId,
    amountCents,
    date: '2026-11-11',
    requestKey,
    description: 'Disposable EGP supplier payment test',
  });

  beforeAll(async () => {
    if (process.env.DATABASE_NAME !== 'kora_test' ||
        !['127.0.0.1', 'localhost', '::1'].includes(process.env.DATABASE_HOST || '127.0.0.1')) {
      throw new Error('REFUSING supplier integration tests: DATABASE_NAME must be kora_test on loopback host');
    }
    const username = process.env.DATABASE_USER || process.env.DB_USER;
    const password = process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD;
    if (!username || !password) {
      throw new Error('Missing local PostgreSQL test credentials');
    }
    db = new DataSource({
      type: 'postgres', host: process.env.DATABASE_HOST || '127.0.0.1',
      port: Number(process.env.DATABASE_PORT || 5432),
      database: 'kora_test', username, password,
      entities: [
        AccountingAccount, JournalEntry, JournalLine,
        Invoice, InvoiceLine, Payment, PurchaseOrder,
        PurchaseOrderLineItem, Supplier, SupplierContact, Product, User,
      ],
      synchronize: false, migrationsRun: false, logging: false,
    });
    await db.initialize();
    const [identity] = await db.query('SELECT current_database() AS db');
    if (identity?.db !== 'kora_test') {
      await db.destroy();
      throw new Error('Refusing: actual database is not kora_test');
    }
    const ap = await db.getRepository(AccountingAccount).findOneBy({ code: '2100' });
    if (!ap || ap.type !== AccountType.LIABILITY || ap.currency !== 'EGP' || !ap.isActive ||
        await db.getRepository(AccountingAccount).existsBy({ parentId: ap.id })) {
      throw new Error('Pilot test prerequisite: account 2100 must be an active leaf EGP liability. Run check-supplier-pilot-readiness.js.');
    }
    const [schema] = await db.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_schema='public'
          AND table_name='payments' AND column_name='request_key' AND data_type='uuid'
      ) AS column_ready,
      EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname='public'
          AND tablename='payments' AND indexname='uq_payments_request_key'
      ) AS index_ready
    `);
    if (!schema.column_ready || !schema.index_ready) {
      throw new Error('Run node scripts/prepare-supplier-request-key-test-db.js on local kora_test first');
    }
    apId = ap.id;
    process.env.SUPPLIER_EGP_PILOT = 'true';
    service = new SupplierEgpPilotService(db);
  });

  beforeEach(async () => {
    const tag = randomUUID().replace(/-/g, '').slice(0, 16);
    const bank = await db.getRepository(AccountingAccount).save(
      db.getRepository(AccountingAccount).create({
        code: '11IT' + tag, name: 'TEST EGP bank (disposable)',
        type: AccountType.ASSET, currency: 'EGP', isActive: true,
      }),
    );
    bankId = bank.id;
    const expense = await db.getRepository(AccountingAccount).save(
      db.getRepository(AccountingAccount).create({
        code: '5IT' + tag, name: 'TEST supplier expense (disposable)',
        type: AccountType.EXPENSE, currency: 'EGP', isActive: true,
      }),
    );
    expenseId = expense.id;
    const invoice = await db.getRepository(Invoice).save(
      db.getRepository(Invoice).create({
        number: 'IT-SUP-' + tag,
        type: InvoiceType.INCOMING, status: InvoiceStatus.SENT,
        currency: 'EGP', total: 1000, subtotal: 1000, tax: 0,
        date: '2026-11-11', dueDate: '2026-12-11',
        lines: [],
      }),
    );
    invoiceId = invoice.id;
    const booked = await db.getRepository(JournalEntry).save(
      db.getRepository(JournalEntry).create({
        type: JournalEntryType.INVOICE, invoiceId,
        date: '2026-11-11', description: 'Disposable supplier invoice booking',
        sourceEventKey: 'test:invoice:' + tag, postingStatus: 'posted', postedAt: new Date(),
        lines: [
          db.getRepository(JournalLine).create({
            accountId: expenseId, currency: 'EGP', exchangeRate: 1,
            debit: 1000, credit: 0, amountBase: 1000, amountEgp: 1000,
          }),
          db.getRepository(JournalLine).create({
            accountId: apId, currency: 'EGP', exchangeRate: 1,
            debit: 0, credit: 1000, amountBase: -1000, amountEgp: -1000,
          }),
        ],
      }),
    );
    bookingId = booked.id;
    const users = await db.getRepository(User).save([
      db.getRepository(User).create({
        email: `it-accountant-${tag}@example.invalid`,
        password: 'NOT-A-LOGIN', name: 'Disposable Accountant', role: 'accountant',
      }),
      db.getRepository(User).create({
        email: `it-employee-${tag}@example.invalid`,
        password: 'NOT-A-LOGIN', name: 'Disposable Employee', role: 'employee',
      }),
    ]);
    accountantId = users[0].id;
    employeeId = users[1].id;
  });

  afterEach(async () => {
    if (!db?.isInitialized) return;
    // Restrict every delete to IDs created in this test. Avoid touching legacy rows.
    if (invoiceId) {
      // Remove reversal children before their original journals, in case the
      // database enforces the reversal_of_id self-reference.
      await db.query(
        'DELETE FROM journal_entries WHERE invoice_id = $1 AND reversal_of_id IS NOT NULL',
        [invoiceId],
      );
      await db.getRepository(JournalEntry).delete({ invoiceId });
      await db.getRepository(Payment).delete({ invoiceId });
      await db.getRepository(Invoice).delete({ id: invoiceId });
    }
    if (accountantId) await db.getRepository(User).delete({ id: accountantId });
    if (employeeId) await db.getRepository(User).delete({ id: employeeId });
    if (bankId) await db.getRepository(AccountingAccount).delete({ id: bankId });
    if (expenseId) await db.getRepository(AccountingAccount).delete({ id: expenseId });
    invoiceId = 0; bookingId = 0; bankId = 0; expenseId = 0; accountantId = 0; employeeId = 0;
  });

  afterAll(async () => {
    if (priorEnv === undefined) delete process.env.SUPPLIER_EGP_PILOT;
    else process.env.SUPPLIER_EGP_PILOT = priorEnv;
    if (db?.isInitialized) await db.destroy();
  });

  it('persists two partial payments, their balanced journals, and final paid status', async () => {
    const first = await service.create(args(randomUUID(), 40000));
    expect(first).toEqual(expect.objectContaining({
      status: 'partially_paid', remainingCents: 60000, replayed: false,
    }));
    const second = await service.create(args(randomUUID(), 60000));
    expect(second).toEqual(expect.objectContaining({
      status: 'paid', remainingCents: 0, replayed: false,
    }));
    const invoice = await db.getRepository(Invoice).findOneByOrFail({ id: invoiceId });
    expect(invoice.status).toBe('paid');
    const payments = await db.getRepository(Payment).findBy({ invoiceId });
    expect(payments).toHaveLength(2);
    const journals = await db.getRepository(JournalEntry).find({
      where: { invoiceId, type: JournalEntryType.PAYMENT },
      relations: { lines: true },
    });
    expect(journals).toHaveLength(2);
    expect(journals.map(j => j.sourceEventKey).sort()).toEqual(
      payments.map(p => `supplier-payment:${p.id}:posted:v1`).sort(),
    );
    for (const journal of journals) {
      expect(journal.postingStatus).toBe('posted');
      expect(journal.lines).toHaveLength(2);
      const apLine = journal.lines.find(l => l.accountId === apId)!;
      const bankLine = journal.lines.find(l => l.accountId === bankId)!;
      expect(apLine.debit).toBeGreaterThan(0);
      expect(bankLine.credit).toBe(apLine.debit);
      expect(Number(apLine.amountBase) + Number(bankLine.amountBase)).toBe(0);
    }
  });

  it('replays an identical request without creating another payment or journal', async () => {
    const input = args();
    const original = await service.create(input);
    const [stored] = await db.query('SELECT request_key, reference FROM public.payments WHERE id = $1', [original.paymentId]);
    expect(stored.request_key).toBe(input.requestKey);
    expect(stored.reference).toBe(`SUP-PAY-${original.paymentId}`);
    const replay = await service.create(input);
    expect(replay).toEqual({ ...original, replayed: true });
    expect(await db.getRepository(Payment).countBy({ invoiceId })).toBe(1);
    expect(await db.getRepository(JournalEntry).countBy({
      invoiceId, type: JournalEntryType.PAYMENT,
    })).toBe(1);
  });

  it('rejects reusing the same request identity with different amount', async () => {
    const input = args();
    await service.create(input);
    await expect(service.create({ ...input, amountCents: 35000 }))
      .rejects.toThrow(ConflictException);
    expect(await db.getRepository(Payment).countBy({ invoiceId })).toBe(1);
  });

  it('does not double-post simultaneous submissions with the same request key', async () => {
    const input = args(randomUUID(), 40000);
    const results = await Promise.allSettled([
      service.create(input),
      service.create(input),
    ]);

    // Under SERIALIZABLE, one concurrent request may be rejected with SQLSTATE
    // 40001 instead of replaying. That is acceptable only if a later retry
    // with the same key returns the first saved payment.
    expect(results.some(r => r.status === 'fulfilled')).toBe(true);
    const original = results.find(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof service.create>>> =>
        r.status === 'fulfilled',
    )!.value;
    const retry = await service.create(input);
    expect(retry.paymentId).toBe(original.paymentId);
    expect(retry.journalId).toBe(original.journalId);
    expect(retry.replayed).toBe(true);

    expect(await db.getRepository(Payment).countBy({ invoiceId })).toBe(1);
    expect(await db.getRepository(JournalEntry).countBy({
      invoiceId, type: JournalEntryType.PAYMENT,
    })).toBe(1);
    const invoice = await db.getRepository(Invoice).findOneByOrFail({ id: invoiceId });
    expect(invoice.status).toBe('partially_paid');
  });

  it('does not overpay when two distinct concurrent payments exceed the invoice total', async () => {
    const first = args(randomUUID(), 60000);
    const second = args(randomUUID(), 60000);
    const results = await Promise.allSettled([
      service.create(first),
      service.create(second),
    ]);

    // Only one 600-EGP payment may commit against a 1,000-EGP invoice.
    // The other must fail (overpayment or serializable conflict).
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect(await db.getRepository(Payment).countBy({ invoiceId })).toBe(1);
    expect(await db.getRepository(JournalEntry).countBy({
      invoiceId, type: JournalEntryType.PAYMENT,
    })).toBe(1);
    const invoice = await db.getRepository(Invoice).findOneByOrFail({ id: invoiceId });
    expect(invoice.status).toBe('partially_paid');
    const savedPayment = await db.getRepository(Payment).findOneByOrFail({ invoiceId });
    const [savedKey] = await db.query('SELECT request_key FROM public.payments WHERE id = $1', [savedPayment.id]);
    const rejectedInput = savedKey.request_key === first.requestKey ? second : first;
    await expect(service.create(rejectedInput)).rejects.toThrow();
    expect(await db.getRepository(Payment).countBy({ invoiceId })).toBe(1);
  });

  it('enforces UUID uniqueness at the PostgreSQL index even when bypassing the service', async () => {
    const created = await service.create(args());
    // A duplicate assignment to a separate row must fail at the database,
    // proving the invariant does not depend solely on application locks.
    const second = await service.create(args());
    const [firstRow] = await db.query('SELECT request_key FROM public.payments WHERE id = $1', [created.paymentId]);
    await expect(db.query(
      'UPDATE public.payments SET request_key = $1::uuid WHERE id = $2',
      [firstRow.request_key, second.paymentId],
    )).rejects.toMatchObject({ code: '23505' });
    expect(await db.getRepository(Payment).countBy({ invoiceId })).toBe(2);
  });

  it('reverses a full payment without deleting payment or original journal', async () => {
    const saved = await service.create(args(randomUUID(), 100000));
    const reversed = await service.reverse(saved.paymentId, accountantId, 'Incorrect bank transfer');
    expect(reversed.status).toBe('sent');
    expect(reversed.remainingCents).toBe(100000);
    expect(await db.getRepository(Payment).countBy({ invoiceId })).toBe(1);
    const original = await db.getRepository(JournalEntry).findOneByOrFail({ id: saved.journalId });
    expect(original.postingStatus).toBe('reversed');
    expect(original.reversedById).toBe(accountantId);
    const reversal = await db.getRepository(JournalEntry).findOne({
      where: { id: reversed.reversalJournalId }, relations: { lines: true },
    });
    expect(reversal?.reversalOfId).toBe(original.id);
    expect(reversal?.sourceEventKey).toBe(`supplier-payment:${saved.paymentId}:reversal:v1`);
    const values = await db.query(`
      SELECT l.account_id AS account_id, SUM(l.debit - l.credit)::numeric AS net
      FROM journal_lines l JOIN journal_entries j ON j.id=l.journal_entry_id
      WHERE j.id = $1 OR j.id = $2 GROUP BY l.account_id
    `, [original.id, reversed.reversalJournalId]);
    expect(values).toHaveLength(2);
    expect(values.every((v: {net: string}) => Number(v.net) === 0)).toBe(true);
    await expect(service.reverse(saved.paymentId, accountantId, 'Again'))
      .rejects.toThrow(ConflictException);
    expect(await db.getRepository(JournalEntry).countBy({
      reversalOfId: saved.journalId,
    })).toBe(1);
  });

  it('recomputes outstanding balance using only unreversed settlements', async () => {
    const first = await service.create(args(randomUUID(), 40000));
    await service.create(args(randomUUID(), 20000));
    const reversed = await service.reverse(first.paymentId, accountantId, 'First transfer returned');
    expect(reversed).toEqual(expect.objectContaining({
      status: 'partially_paid', remainingCents: 80000,
    }));
    const replacement = await service.create(args(randomUUID(), 80000));
    expect(replacement).toEqual(expect.objectContaining({ status: 'paid', remainingCents: 0 }));
    expect(await db.getRepository(Payment).countBy({ invoiceId })).toBe(3);
    expect(await db.getRepository(JournalEntry).countBy({
      invoiceId, type: JournalEntryType.PAYMENT,
    })).toBe(4); // three original journals + one reversal
  });

  it('rejects reversal by an employee or without a reason', async () => {
    const saved = await service.create(args());
    await expect(service.reverse(saved.paymentId, employeeId, 'Not authorized'))
      .rejects.toThrow(ForbiddenException);
    await expect(service.reverse(saved.paymentId, accountantId, ' '))
      .rejects.toThrow();
    expect((await db.getRepository(JournalEntry).findOneByOrFail({ id: saved.journalId })).postingStatus)
      .toBe('posted');
  });

  it('rolls back a reversal and leaves the original payment posted if the transaction fails', async () => {
    const saved = await service.create(args(randomUUID(), 40000));
    const failingDb = {
      transaction: (
        isolation: 'SERIALIZABLE',
        callback: (manager: EntityManager) => Promise<unknown>,
      ) => db.transaction(isolation, async manager => {
        await callback(manager);
        throw new Error('intentional reversal rollback');
      }),
    } as unknown as DataSource;
    const failing = new SupplierEgpPilotService(failingDb);
    await expect(failing.reverse(saved.paymentId, accountantId, 'Incorrect bank'))
      .rejects.toThrow('intentional reversal rollback');
    expect(await db.getRepository(JournalEntry).countBy({
      reversalOfId: saved.journalId,
    })).toBe(0);
    const original = await db.getRepository(JournalEntry).findOneByOrFail({ id: saved.journalId });
    expect(original.postingStatus).toBe('posted');
    const invoice = await db.getRepository(Invoice).findOneByOrFail({ id: invoiceId });
    expect(invoice.status).toBe('partially_paid');
  });

  it('allows only one of two simultaneous reversals to commit', async () => {
    const saved = await service.create(args());
    const outcomes = await Promise.allSettled([
      service.reverse(saved.paymentId, accountantId, 'Duplicate request A'),
      service.reverse(saved.paymentId, accountantId, 'Duplicate request B'),
    ]);
    expect(outcomes.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect(await db.getRepository(JournalEntry).countBy({
      reversalOfId: saved.journalId,
    })).toBe(1);
    const invoice = await db.getRepository(Invoice).findOneByOrFail({ id: invoiceId });
    expect(invoice.status).toBe('sent');
  });

  it('shows active, reversed and replacement payments with correct invoice balance', async () => {
    const reversedPayment = await service.create(args(randomUUID(), 40000));
    await service.reverse(reversedPayment.paymentId, accountantId, 'Incorrect bank transfer');
    const activePayment = await service.create(args(randomUUID(), 20000));
    const replacement = await service.create(args(randomUUID(), 30000));
    const balance = await service.getInvoiceBalance(invoiceId);

    expect(balance).toEqual(expect.objectContaining({
      invoiceId, currency: 'EGP', totalCents: 100000,
      paidCents: 50000, reversedCents: 40000, outstandingCents: 50000,
    }));
    expect(balance.payments).toHaveLength(3);
    const reversed = balance.payments.find(p => p.paymentId === reversedPayment.paymentId);
    expect(reversed).toEqual(expect.objectContaining({
      status: 'reversed', amountCents: 40000,
    }));
    expect(reversed?.reversal?.byUserId).toBe(accountantId);
    expect(reversed?.reversal?.reason).toBe('Incorrect bank transfer');
    expect(reversed?.reversal?.journalId).toEqual(expect.any(Number));
    expect(balance.payments.find(p => p.paymentId === activePayment.paymentId)?.status)
      .toBe('active');
    expect(balance.payments.find(p => p.paymentId === replacement.paymentId)?.status)
      .toBe('active');

    const report = await service.getPilotAccountsPayable();
    expect(report).toEqual(expect.objectContaining({
      currency: 'EGP', invoiceCount: 1, totalCents: 100000,
      paidCents: 50000, reversedCents: 40000, outstandingCents: 50000,
    }));
    expect(report.invoices).toHaveLength(1);
    expect(report.invoices[0].invoiceId).toBe(invoiceId);
  });

  it('reports a fully reversed invoice as entirely outstanding without erasing history', async () => {
    const paid = await service.create(args(randomUUID(), 100000));
    await service.reverse(paid.paymentId, accountantId, 'Transfer rejected by bank');
    const report = await service.getPilotAccountsPayable();
    expect(report).toEqual(expect.objectContaining({
      invoiceCount: 1, paidCents: 0, reversedCents: 100000,
      outstandingCents: 100000,
    }));
    expect(report.invoices[0].payments).toHaveLength(1);
    expect(report.invoices[0].payments[0].status).toBe('reversed');
  });

  it('refuses reporting inconsistent journals instead of showing misleading balances', async () => {
    const paid = await service.create(args());
    await db.query(
      'UPDATE journal_entries SET posting_status = $1 WHERE id = $2',
      ['draft', paid.journalId],
    );
    await expect(service.getInvoiceBalance(invoiceId)).rejects.toThrow(ConflictException);
    await expect(service.getPilotAccountsPayable()).rejects.toThrow(ConflictException);
  });

  it('rolls back payment, journal, and invoice status when a transaction fails after writing', async () => {
    const failingDb = {
      transaction: (
        isolation: 'SERIALIZABLE',
        callback: (manager: EntityManager) => Promise<unknown>,
      ) => db.transaction(isolation, async manager => {
        await callback(manager);
        throw new Error('intentional rollback after supplier settlement');
      }),
    } as unknown as DataSource;
    const failing = new SupplierEgpPilotService(failingDb);
    await expect(failing.create(args())).rejects.toThrow('intentional rollback');
    expect(await db.getRepository(Payment).countBy({ invoiceId })).toBe(0);
    expect(await db.getRepository(JournalEntry).countBy({
      invoiceId, type: JournalEntryType.PAYMENT,
    })).toBe(0);
    const invoice = await db.getRepository(Invoice).findOneByOrFail({ id: invoiceId });
    expect(invoice.status).toBe('sent');
  });
});
