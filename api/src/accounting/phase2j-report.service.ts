import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AccountingAccount } from './entities/accounting-account.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Payment } from '../payments/entities/payment.entity';
import { JournalEntry } from './entities/journal-entry.entity';
import { buildPhase2JReport } from './phase2j-report.policy';

/**
 * Phase 2J is isolated from the existing production-facing reporting routes.
 * Read-only snapshot of the disposable local kora_test DB, with explicit
 * manual-review flags for legacy links and non-EGP source transactions.
 */
@Injectable()
export class Phase2JReportService {
  constructor(private readonly db: DataSource) {}

  async get(startDate: string, endDate: string, asOfDate: string) {
    if (process.env.ACCOUNTING_PHASE2J_REPORT !== 'true' ||
        process.env.DATABASE_NAME !== 'kora_test' ||
        !['localhost', '127.0.0.1', '::1'].includes(
          process.env.DATABASE_HOST || '127.0.0.1')) {
      throw new ForbiddenException('Phase 2J reports are limited to local kora_test');
    }
    const validDate = (value: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value;
    if (![startDate, endDate, asOfDate].every(validDate) ||
        startDate > endDate || endDate > asOfDate) {
      throw new BadRequestException('Use valid dates with startDate <= endDate <= asOfDate');
    }

    return this.db.transaction('REPEATABLE READ', async manager => {
      await manager.query('SET TRANSACTION READ ONLY');
      const [identity] = await manager.query('SELECT current_database() AS database_name');
      if (identity?.database_name !== 'kora_test') {
        throw new ForbiddenException('Phase 2J report may only read local kora_test');
      }
      // Sequential finds are deliberately kept within one consistent snapshot.
      const invoices = await manager.find(Invoice, { relations: { supplier: true } });
      const payments = await manager.find(Payment);
      const journals = await manager.find(JournalEntry, { relations: { lines: true } });
      const accounts = await manager.find(AccountingAccount);
      return buildPhase2JReport({ startDate, endDate, asOfDate,
        invoices, payments, journals, accounts });
    });
  }
}
