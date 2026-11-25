import {
  ForbiddenException, Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Payment } from '../payments/entities/payment.entity';
import { JournalEntry } from './entities/journal-entry.entity';
import { reconcileInvoicePayments, InvoiceReconciliationRow } from './invoice-payment-reconciliation';

export interface ReconciliationAudit {
  scope: 'local-kora-test';
  totalInvoices: number;
  flaggedInvoices: number;
  unassignedPayments: number[];
  unassignedJournals: number[];
  invoices: InvoiceReconciliationRow[];
}

/**
 * Opt-in local, read-only diagnostic. Never performs migrations, backfills,
 * adjustments, or writes to production.
 */
@Injectable()
export class InvoicePaymentReconciliationService {
  constructor(private readonly db: DataSource) {}

  async audit(): Promise<ReconciliationAudit> {
    if (process.env.ACCOUNTING_RECONCILIATION_AUDIT !== 'true' ||
        process.env.DATABASE_NAME !== 'kora_test' ||
        !['localhost', '127.0.0.1', '::1'].includes(process.env.DATABASE_HOST || '127.0.0.1')) {
      throw new ForbiddenException('Accounting reconciliation audit is limited to local kora_test');
    }
    return this.db.transaction('REPEATABLE READ', async manager => {
      await manager.query('SET TRANSACTION READ ONLY');
      const [identity] = await manager.query('SELECT current_database() AS name');
      if (identity?.name !== 'kora_test') {
        throw new ForbiddenException('Actual database is not kora_test');
      }

      // A single consistent snapshot covers all three tables.
      const [invoices, payments, journals] = await Promise.all([
        manager.find(Invoice, { order: { id: 'ASC' } }),
        manager.find(Payment, { order: { id: 'ASC' } }),
        manager.find(JournalEntry, { order: { id: 'ASC' } }),
      ]);
      const ids = new Set(invoices.map(i => i.id));
      return {
        scope: 'local-kora-test' as const,
        totalInvoices: invoices.length,
        flaggedInvoices: invoices.filter(i =>
          !reconcileInvoicePayments(i,
            payments.filter(p => p.invoiceId === i.id),
            journals.filter(j => j.invoiceId === i.id)).clean).length,
        unassignedPayments: payments.filter(p => !p.invoiceId || !ids.has(p.invoiceId)).map(p => p.id),
        unassignedJournals: journals.filter(j => j.invoiceId && !ids.has(j.invoiceId)).map(j => j.id),
        invoices: invoices.map(i =>
          reconcileInvoicePayments(i,
            payments.filter(p => p.invoiceId === i.id),
            journals.filter(j => j.invoiceId === i.id))),
      };
    });
  }
}
