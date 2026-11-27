import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { Phase2MReadinessService } from './phase2m-readiness.service';
import { AccountingAccount } from './entities/accounting-account.entity';
import { JournalEntry } from './entities/journal-entry.entity';
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

describe('Phase 2M read-only local PostgreSQL audit', () => {
  let db: DataSource;
  let audit: Phase2MReadinessService;
  const original = process.env.ACCOUNTING_PHASE2M_AUDIT;

  beforeAll(async () => {
    if (process.env.DATABASE_NAME !== 'kora_test' ||
        !['127.0.0.1', 'localhost', '::1'].includes(
          process.env.DATABASE_HOST || '127.0.0.1')) {
      throw new Error('REFUSING Phase 2M integration test: disposable local kora_test required');
    }
    const username = process.env.DATABASE_USER || process.env.DB_USER;
    const password = process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD;
    if (!username || !password) throw new Error('Missing disposable test PostgreSQL credentials');
    db = new DataSource({
      type: 'postgres', host: process.env.DATABASE_HOST || '127.0.0.1',
      port: Number(process.env.DATABASE_PORT || 5432),
      database: 'kora_test', username, password,
      entities: [AccountingAccount, JournalEntry, JournalLine, Invoice,
        InvoiceLine, Payment, Supplier, SupplierContact, PurchaseOrder,
        PurchaseOrderLineItem, Product, User],
      migrationsRun: false, synchronize: false, logging: false,
    });
    await db.initialize();
    const [identity] = await db.query('SELECT current_database() AS name');
    if (identity?.name !== 'kora_test') {
      await db.destroy();
      throw new Error('REFUSING: actual connected database is not kora_test');
    }
    audit = new Phase2MReadinessService(db);
    process.env.ACCOUNTING_PHASE2M_AUDIT = 'true';
  });

  afterAll(async () => {
    if (original === undefined) delete process.env.ACCOUNTING_PHASE2M_AUDIT;
    else process.env.ACCOUNTING_PHASE2M_AUDIT = original;
    if (db?.isInitialized) await db.destroy();
  });

  it('returns data from a real read-only snapshot and never approves a release', async () => {
    const before = await db.query(`
      SELECT
        (SELECT count(*)::bigint FROM invoices)::text AS invoices,
        (SELECT count(*)::bigint FROM payments)::text AS payments,
        (SELECT count(*)::bigint FROM journal_entries)::text AS journals,
        (SELECT count(*)::bigint FROM journal_lines)::text AS lines`);
    const output = await audit.audit();
    expect(output.scope).toBe('local-kora-test');
    expect(output.readyForProduction).toBe(false);
    expect(output.reportType).toBe('phase2m-diagnostic-not-release-approval');
    expect(output.counts.invoices).toBe(Number(before[0].invoices));
    expect(output.counts.payments).toBe(Number(before[0].payments));
    expect(output.counts.journals).toBe(Number(before[0].journals));
    expect(output.counts.journalLines).toBe(Number(before[0].lines));
    const after = await db.query(`
      SELECT
        (SELECT count(*)::bigint FROM invoices)::text AS invoices,
        (SELECT count(*)::bigint FROM payments)::text AS payments,
        (SELECT count(*)::bigint FROM journal_entries)::text AS journals,
        (SELECT count(*)::bigint FROM journal_lines)::text AS lines`);
    expect(after).toEqual(before);
  });
});
