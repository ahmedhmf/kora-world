import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { ConflictException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AccountingPostingService } from './accounting-posting.service';
import { AccountingAccount } from './entities/accounting-account.entity';
import { JournalEntry, JournalEntryType } from './entities/journal-entry.entity';
import { JournalLine } from './entities/journal-line.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { SupplierContact } from '../suppliers/entities/supplier-contact.entity';
import { Product } from '../products/entities/product.entity';
import { PurchaseOrderLineItem } from '../purchase-orders/entities/purchase-order-line-item.entity';
import { InvoiceLine } from '../invoices/entities/invoice-line.entity';

/**
 * Real PostgreSQL integration tests; do not start NestJS AppModule.
 * Related document entities are loaded only so TypeORM can resolve
 * JournalEntry's actual runtime relation targets.
 */

describe('AccountingPostingService (PostgreSQL integration)', () => {
  let db: DataSource;
  let service: AccountingPostingService;
  let debitAccountId: number;
  let creditAccountId: number;
  const eventKeys: string[] = [];

  const event = (sourceEventKey: string) => ({
    sourceEventKey,
    date: '2026-11-11',
    description: 'Integration test posting',
    type: JournalEntryType.MANUAL,
    lines: [
      { accountId: debitAccountId, debitCents: 12345, creditCents: 0 },
      { accountId: creditAccountId, debitCents: 0, creditCents: 12345 },
    ],
  });

  beforeAll(async () => {
    // Fail closed: the exact requested database name is compulsory.
    if (process.env.DATABASE_NAME !== 'kora_test') {
      throw new Error('REFUSING accounting PostgreSQL integration tests: DATABASE_NAME must equal kora_test');
    }
    const host = process.env.DATABASE_HOST || '127.0.0.1';
    if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
      throw new Error('REFUSING integration tests: DATABASE_HOST must be local');
    }
    const dbUser = process.env.DATABASE_USER || process.env.DB_USER;
    const dbPassword = process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD;
    if (!dbUser || !dbPassword) {
      throw new Error('Missing DATABASE_USER/DATABASE_PASSWORD or DB_USER/DB_PASSWORD');
    }
    db = new DataSource({
      type: 'postgres',
      host,
      port: Number(process.env.DATABASE_PORT || 5432),
      username: dbUser,
      password: dbPassword,
      database: 'kora_test',
      entities: [
        AccountingAccount, JournalEntry, JournalLine,
        Invoice, InvoiceLine, PurchaseOrder, PurchaseOrderLineItem,
        Supplier, SupplierContact, Product,
      ],
      synchronize: false,
      migrationsRun: false,
      logging: false,
    });
    await db.initialize();
    const [identity] = await db.query('SELECT current_database() AS database_name');
    if (identity?.database_name !== 'kora_test') {
      await db.destroy();
      throw new Error('REFUSING tests: connected database is not kora_test');
    }
    const [schemaCheck] = await db.query(`
      SELECT
        to_regclass('public.accounting_accounts') IS NOT NULL AS accounts_ready,
        to_regclass('public.journal_entries') IS NOT NULL AS entries_ready,
        to_regclass('public.journal_lines') IS NOT NULL AS lines_ready,
        EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public' AND tablename = 'journal_entries'
          AND indexname = 'uq_journal_source_event'
        ) AS posting_migration_ready
    `);
    if (!schemaCheck.accounts_ready || !schemaCheck.entries_ready ||
        !schemaCheck.lines_ready || !schemaCheck.posting_migration_ready) {
      await db.destroy();
      throw new Error('kora_test needs the existing application migrations and posting foundation migration before integration tests');
    }

    const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
    const a = await db.query(
      'INSERT INTO accounting_accounts (code, name, type, currency, is_active) VALUES ($1, $2, $3, $4, true) RETURNING id',
      [`IT-DR-${suffix}`, 'Integration Debit', 'asset', 'EGP'],
    );
    debitAccountId = a[0].id;
    const b = await db.query(
      'INSERT INTO accounting_accounts (code, name, type, currency, is_active) VALUES ($1, $2, $3, $4, true) RETURNING id',
      [`IT-CR-${suffix}`, 'Integration Credit', 'liability', 'EGP'],
    );
    creditAccountId = b[0].id;
    service = new AccountingPostingService(db);
  });

  afterAll(async () => {
    if (!db?.isInitialized) return;
    try {
      if (eventKeys.length) {
        await db.query('DELETE FROM journal_entries WHERE source_event_key = ANY($1::varchar[])', [eventKeys]);
      }
      if (debitAccountId && creditAccountId) {
        await db.query('DELETE FROM accounting_accounts WHERE id IN ($1, $2)', [debitAccountId, creditAccountId]);
      }
    } finally {
      await db.destroy();
    }
  });

  it('persists one balanced entry with two real journal lines', async () => {
    const key = `test:accounting-posting:${randomUUID()}`;
    eventKeys.push(key);
    const created = await service.post(event(key));
    const [header] = await db.query(
      'SELECT source_event_key, posting_status FROM journal_entries WHERE id = $1',
      [created.id],
    );
    const lines = await db.query(
      'SELECT debit, credit, amount_base FROM journal_lines WHERE journal_entry_id = $1 ORDER BY id',
      [created.id],
    );
    expect(header.source_event_key).toBe(key);
    expect(header.posting_status).toBe('posted');
    expect(lines).toHaveLength(2);
    expect(lines.reduce((n: number, l: { amount_base: string }) => n + Number(l.amount_base), 0)).toBe(0);
  });

  it('rejects repeat posting via the database unique constraint', async () => {
    const key = `test:accounting-posting:${randomUUID()}`;
    eventKeys.push(key);
    await service.post(event(key));
    await expect(service.post(event(key))).rejects.toThrow(ConflictException);
    const [counts] = await db.query(
      'SELECT COUNT(*)::int AS total FROM journal_entries WHERE source_event_key = $1',
      [key],
    );
    expect(counts.total).toBe(1);
  });

  it('rolls back real journal inserts if the enclosing transaction fails', async () => {
    const key = `test:accounting-posting:${randomUUID()}`;
    eventKeys.push(key);
    const rollbackConnection = {
      transaction: (callback: (manager: EntityManager) => Promise<JournalEntry>) =>
        db.transaction(async (manager) => {
          await callback(manager);
          throw new Error('intentionally fail transaction after writing journal lines');
        }),
    };
    const rollbackService = new AccountingPostingService(rollbackConnection as unknown as DataSource);
    await expect(rollbackService.post(event(key))).rejects.toThrow('intentionally fail transaction');
    const [counts] = await db.query(
      'SELECT COUNT(*)::int AS total FROM journal_entries WHERE source_event_key = $1',
      [key],
    );
    expect(counts.total).toBe(0);
  });
});
