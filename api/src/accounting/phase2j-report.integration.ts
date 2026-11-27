import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { Phase2JReportService } from './phase2j-report.service';
import { AccountingAccount, AccountType } from './entities/accounting-account.entity';
import { JournalEntry, JournalEntryType } from './entities/journal-entry.entity';
import { JournalLine } from './entities/journal-line.entity';
import { Invoice, InvoiceStatus, InvoiceType } from '../invoices/entities/invoice.entity';
import { InvoiceLine } from '../invoices/entities/invoice-line.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { SupplierContact } from '../suppliers/entities/supplier-contact.entity';
import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';
import { PurchaseOrderLineItem } from '../purchase-orders/entities/purchase-order-line-item.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Real local test DB report checks. Uses only uniquely named fixture rows.
 * No migrations, synchronization or production DB operations.
 */
describe('Phase 2J combined report (local PostgreSQL)', () => {
  let db: DataSource;
  let service: Phase2JReportService;
  let invoiceId = 0;
  let paymentId = 0;
  let bankId = 0;
  let apId: number;
  let expenseId: number;
  let originalJournalId = 0;
  const savedFlag = process.env.ACCOUNTING_PHASE2J_REPORT;
  const period = { start: '2036-02-01', end: '2036-02-28', asOf: '2036-02-28' };

  beforeAll(async () => {
    if (process.env.DATABASE_NAME !== 'kora_test' ||
        !['127.0.0.1', 'localhost', '::1'].includes(process.env.DATABASE_HOST || '127.0.0.1')) {
      throw new Error('REFUSING Phase 2J integration tests: DATABASE_NAME must be kora_test on loopback host');
    }
    const username = process.env.DATABASE_USER || process.env.DB_USER;
    const password = process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD;
    if (!username || !password) throw new Error('Missing test PostgreSQL credentials');
    db = new DataSource({
      type: 'postgres', host: process.env.DATABASE_HOST || '127.0.0.1',
      port: Number(process.env.DATABASE_PORT || 5432),
      database: 'kora_test', username, password,
      entities: [AccountingAccount, JournalEntry, JournalLine, Invoice,
        InvoiceLine, Payment, PurchaseOrder, PurchaseOrderLineItem,
        Supplier, SupplierContact, Product, User],
      synchronize: false, migrationsRun: false, logging: false,
    });
    await db.initialize();
    const [identity] = await db.query('SELECT current_database() AS name');
    if (identity?.name !== 'kora_test') {
      await db.destroy();
      throw new Error('REFUSING: connected database is not kora_test');
    }
    for (const [code, type] of [['2100', AccountType.LIABILITY],
      ['5100', AccountType.EXPENSE]] as const) {
      const account = await db.getRepository(AccountingAccount).findOneBy({ code });
      if (!account || account.currency !== 'EGP' || account.type !== type || !account.isActive ||
          await db.getRepository(AccountingAccount).existsBy({ parentId: account.id })) {
        throw new Error(`Prerequisite ${code}: active leaf EGP account expected`);
      }
      if (code === '2100') apId = account.id;
      if (code === '5100') expenseId = account.id;
    }
    process.env.ACCOUNTING_PHASE2J_REPORT = 'true';
    service = new Phase2JReportService(db);
  });

  beforeEach(async () => {
    const tag = randomUUID().replace(/-/g, '').slice(0, 16);
    const bankRepo = db.getRepository(AccountingAccount);
    const bank = await bankRepo.save(bankRepo.create({
      code: '11RJ' + tag, name: 'Disposable Phase 2J bank',
      type: AccountType.ASSET, currency: 'EGP', isActive: true,
    }));
    bankId = bank.id;
    const invRepo = db.getRepository(Invoice);
    const invoice = await invRepo.save(invRepo.create({
      number: 'IT-RJ-' + tag, type: InvoiceType.INCOMING,
      currency: 'EGP', status: InvoiceStatus.SENT,
      total: 1000, subtotal: 1000, tax: 0,
      date: '2036-02-05', dueDate: '2036-02-25', lines: [],
    }));
    invoiceId = invoice.id;
    const journals = db.getRepository(JournalEntry);
    await journals.save(journals.create({
      invoiceId, type: JournalEntryType.INVOICE, date: '2036-02-05',
      description: 'Phase 2J disposable booking', postingStatus: 'posted',
      sourceEventKey: `test:report:${tag}`, postedAt: new Date(),
      lines: [
        db.getRepository(JournalLine).create({ accountId: expenseId, debit: 1000, credit: 0,
          currency: 'EGP', exchangeRate: 1, amountBase: 1000, amountEgp: 1000 }),
        db.getRepository(JournalLine).create({ accountId: apId, debit: 0, credit: 1000,
          currency: 'EGP', exchangeRate: 1, amountBase: -1000, amountEgp: -1000 }),
      ],
    }));
    const payRepo = db.getRepository(Payment);
    const payment = await payRepo.save(payRepo.create({
      invoiceId, date: '2036-02-12', amount: 400, currency: 'EGP',
      exchangeRate: 1, amountBase: 400, amountEgp: 400,
      method: 'bank_transfer', reference: 'IT-RJ-PAY-' + tag,
      description: 'Disposable Phase 2J settlement',
      paidFromAccountId: bankId, categoryAccountId: apId,
    }));
    paymentId = payment.id;
    const original = await journals.save(journals.create({
      invoiceId, type: JournalEntryType.PAYMENT, date: '2036-02-12',
      description: 'Phase 2J disposable payment', postingStatus: 'posted',
      sourceEventKey: `supplier-payment:${paymentId}:posted:v1`, postedAt: new Date(),
      lines: [
        db.getRepository(JournalLine).create({ accountId: apId, debit: 400, credit: 0,
          currency: 'EGP', exchangeRate: 1, amountBase: 400, amountEgp: 400 }),
        db.getRepository(JournalLine).create({ accountId: bankId, debit: 0, credit: 400,
          currency: 'EGP', exchangeRate: 1, amountBase: -400, amountEgp: -400 }),
      ],
    }));
    originalJournalId = original.id;
  });

  afterEach(async () => {
    if (!db?.isInitialized) return;
    if (invoiceId) {
      // Reversal journals are children of the original journal and must be
      // removed first if the local test schema enforces reversal_of_id FK.
      await db.query(
        'DELETE FROM journal_entries WHERE invoice_id = $1 AND reversal_of_id IS NOT NULL',
        [invoiceId],
      );
      await db.getRepository(JournalEntry).delete({ invoiceId });
      await db.getRepository(Payment).delete({ invoiceId });
      await db.getRepository(Invoice).delete({ id: invoiceId });
    }
    if (bankId) await db.getRepository(AccountingAccount).delete({ id: bankId });
    invoiceId = 0; paymentId = 0; bankId = 0; originalJournalId = 0;
  });

  afterAll(async () => {
    if (savedFlag === undefined) delete process.env.ACCOUNTING_PHASE2J_REPORT;
    else process.env.ACCOUNTING_PHASE2J_REPORT = savedFlag;
    if (db?.isInitialized) await db.destroy();
  });

  it('reads a real snapshot and includes the verified partial supplier balance', async () => {
    const r = await service.get(period.start, period.end, period.asOf);
    const row = r.ap.invoices.find(x => x.invoiceId === invoiceId);
    expect(row).toEqual(expect.objectContaining({
      paid: 400, reversed: 0, outstanding: 600, reviewRequired: false,
    }));
    expect(r.profitLoss.expenses.find(x => x.code === '5100')?.amount).toBeGreaterThanOrEqual(1000);
    expect(r.cashFlow.find(x => x.period === '2036-02')?.outflows).toBeGreaterThanOrEqual(400);
    expect(await db.getRepository(JournalEntry).countBy({ invoiceId })).toBe(2);
  });

  it('counts a posted reversal as outstanding without deleting the payment row', async () => {
    const journalRepo = db.getRepository(JournalEntry);
    await journalRepo.update({ id: originalJournalId }, { postingStatus: 'reversed' });
    await journalRepo.save(journalRepo.create({
      invoiceId, type: JournalEntryType.PAYMENT, date: '2036-02-20',
      description: 'Disposable reversal', reversalOfId: originalJournalId,
      sourceEventKey: `supplier-payment:${paymentId}:reversal:v1`,
      postingStatus: 'posted', postedAt: new Date(),
      lines: [
        db.getRepository(JournalLine).create({ accountId: apId, debit: 0, credit: 400,
          currency: 'EGP', exchangeRate: 1, amountBase: -400, amountEgp: -400 }),
        db.getRepository(JournalLine).create({ accountId: bankId, debit: 400, credit: 0,
          currency: 'EGP', exchangeRate: 1, amountBase: 400, amountEgp: 400 }),
      ],
    }));
    const r = await service.get(period.start, period.end, period.asOf);
    const row = r.ap.invoices.find(x => x.invoiceId === invoiceId);
    expect(row).toEqual(expect.objectContaining({
      paid: 0, reversed: 400, outstanding: 1000, reviewRequired: false,
    }));
    expect(await db.getRepository(Payment).countBy({ invoiceId })).toBe(1);
    const asOfBeforeReversal = await service.get(period.start, '2036-02-15', '2036-02-15');
    expect(asOfBeforeReversal.ap.invoices.find(x => x.invoiceId === invoiceId))
      .toEqual(expect.objectContaining({ paid: 400, outstanding: 600 }));
  });
});
