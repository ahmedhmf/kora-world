import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { Phase2LBankService } from './phase2l-bank.service';
import { AccountingAccount, AccountType } from './entities/accounting-account.entity';
import { JournalEntry, JournalEntryType } from './entities/journal-entry.entity';
import { JournalLine } from './entities/journal-line.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
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

describe('Phase 2L local PostgreSQL flow', () => {
  let db: DataSource;
  let service: Phase2LBankService;
  let bankId = 0, equityId = 0, expenseId = 0, openingId = 0, marketingId = 0, importId = 0;
  let tag = '';
  const oldFlag = process.env.ACCOUNTING_PHASE2L;
  const date = '2035-04-15';

  beforeAll(async () => {
    if (process.env.DATABASE_NAME !== 'kora_test' ||
        !['localhost', '127.0.0.1', '::1'].includes(process.env.DATABASE_HOST || '127.0.0.1')) {
      throw new Error('REFUSING Phase 2L integration: use disposable loopback kora_test');
    }
    const username = process.env.DATABASE_USER || process.env.DB_USER;
    const password = process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD;
    if (!username || !password) throw new Error('Missing test DB credentials');
    db = new DataSource({
      type: 'postgres', host: process.env.DATABASE_HOST || '127.0.0.1',
      port: Number(process.env.DATABASE_PORT || 5432),
      database: 'kora_test', username, password,
      entities: [AccountingAccount, JournalEntry, JournalLine, Invoice,
        InvoiceLine, Payment, Supplier, SupplierContact, PurchaseOrder,
        PurchaseOrderLineItem, Product, User],
      synchronize: false, migrationsRun: false, logging: false,
    });
    await db.initialize();
    const [identity] = await db.query('SELECT current_database() AS name');
    if (identity?.name !== 'kora_test') {
      await db.destroy();
      throw new Error('Actual PostgreSQL database is not kora_test');
    }
    const rows = await db.query(`
      SELECT to_regclass('public.accounting_bank_statement_imports') AS staging`);
    if (!rows[0]?.staging) {
      throw new Error('Phase 2L local migration not applied. Start local backend once, then run integration tests.');
    }
    const expense = await db.getRepository(AccountingAccount).findOneBy({ code: '5300' });
    if (!expense || !expense.isActive || expense.currency !== 'EGP' ||
        expense.type !== AccountType.EXPENSE ||
        await db.getRepository(AccountingAccount).existsBy({ parentId: expense.id })) {
      throw new Error('Test needs active leaf EGP Marketing expense account 5300 in kora_test');
    }
    expenseId = expense.id;
    process.env.ACCOUNTING_PHASE2L = 'true';
    service = new Phase2LBankService(db);
  });

  beforeEach(async () => {
    tag = randomUUID().replace(/-/g, '').slice(0, 14);
    const a = db.getRepository(AccountingAccount);
    bankId = (await a.save(a.create({
      code: '11BL' + tag, name: 'TEST ONLY bank ' + tag,
      currency: 'EGP', type: AccountType.ASSET, isActive: true,
    }))).id;
    equityId = (await a.save(a.create({
      code: '39BL' + tag, name: 'TEST ONLY opening equity ' + tag,
      currency: 'EGP', type: AccountType.EQUITY, isActive: true,
    }))).id;
  });

  afterEach(async () => {
    if (!db?.isInitialized) return;
    if (importId) {
      await db.query('DELETE FROM accounting_bank_reconciliation_events WHERE import_id=$1', [importId]);
      await db.query('DELETE FROM accounting_bank_statement_rows WHERE import_id=$1', [importId]);
      await db.query('DELETE FROM accounting_bank_statement_imports WHERE id=$1', [importId]);
    }
    if (marketingId) await db.getRepository(JournalEntry).delete({ id: marketingId });
    if (openingId) await db.getRepository(JournalEntry).delete({ id: openingId });
    if (bankId) await db.getRepository(AccountingAccount).delete({ id: bankId });
    if (equityId) await db.getRepository(AccountingAccount).delete({ id: equityId });
    bankId = 0; equityId = 0; openingId = 0; marketingId = 0; importId = 0;
  });

  afterAll(async () => {
    if (oldFlag === undefined) delete process.env.ACCOUNTING_PHASE2L;
    else process.env.ACCOUNTING_PHASE2L = oldFlag;
    if (db?.isInitialized) await db.destroy();
  });

  it('posts opening once, imports, matches exactly, unmatches with permanent audit', async () => {
    const opening = {
      date: '2035-04-01', reference: 'OPEN-' + tag,
      lines: [
        { accountId: bankId, debitCents: 50000, creditCents: 0 },
        { accountId: equityId, debitCents: 0, creditCents: 50000 },
      ],
    };
    const first = await service.postOpening(opening, 1);
    openingId = first.journalId;
    expect(first.replayed).toBe(false);
    expect(await service.postOpening(opening, 1))
      .toEqual({ journalId: openingId, replayed: true });

    const j = db.getRepository(JournalEntry);
    const marketing = await j.save(j.create({
      date, type: JournalEntryType.MANUAL, postingStatus: 'posted',
      description: 'Phase 2L disposable Marketing Money Out',
      sourceEventKey: 'test:phase2l:' + tag,
      lines: [
        db.getRepository(JournalLine).create({
          accountId: expenseId, debit: 23.45, credit: 0, amountBase: 23.45,
          amountEgp: 23.45, exchangeRate: 1, currency: 'EGP',
        }),
        db.getRepository(JournalLine).create({
          accountId: bankId, debit: 0, credit: 23.45, amountBase: -23.45,
          amountEgp: -23.45, exchangeRate: 1, currency: 'EGP',
        }),
      ],
    }));
    marketingId = marketing.id;
    const incoming = {
      accountId: bankId, statementKey: 'STMT-' + tag,
      openingBalanceCents: 50000, closingBalanceCents: 47655,
      rows: [{ date, amountCents: -2345, reference: 'MARKETING-' + tag,
        description: 'Expense paid' }],
    };
    const imported = await service.importStatement(incoming, 1);
    importId = imported.importId;
    expect(imported.rowCount).toBe(1);
    await expect(service.importStatement(incoming, 1)).rejects.toThrow();
    let snapshot = await service.list(bankId);
    expect(snapshot.imports[0].varianceCents).toBe('0');
    expect(snapshot.imports[0].rowCount).toBe(1);
    expect(snapshot.rows).toHaveLength(1);
    const rowId = snapshot.rows[0].id as number;
    const line = snapshot.candidates.find(x => x.journalId === marketingId &&
      x.amountCents === '-2345');
    expect(line).toBeDefined();
    const countBefore = await j.count();
    await service.match(rowId, line!.lineId, 'Verified bank reference against marketing transaction', 1);
    snapshot = await service.list(bankId);
    expect(snapshot.rows[0].matchedJournalLineId).toBe(line!.lineId);
    expect(snapshot.imports[0].matchedCount).toBe(1);
    await expect(service.match(rowId, line!.lineId, 'Repeated match', 1)).rejects.toThrow();
    await service.unmatch(rowId, 'Test unmatch audit trail', 1);
    snapshot = await service.list(bankId);
    expect(snapshot.rows[0].matchedJournalLineId).toBeNull();
    expect(snapshot.events.map(x => x.action)).toEqual(expect.arrayContaining(['import', 'match', 'unmatch']));
    expect(await j.count()).toBe(countBefore);
  });
});
