import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AccountingAccount } from './entities/accounting-account.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Payment } from '../payments/entities/payment.entity';
import { JournalEntry } from './entities/journal-entry.entity';
import { auditPhase2M } from './phase2m-readiness.policy';

@Injectable()
export class Phase2MReadinessService {
  constructor(private readonly db: DataSource) {}

  async audit() {
    if (process.env.ACCOUNTING_PHASE2M_AUDIT !== 'true' ||
        process.env.DATABASE_NAME !== 'kora_test' ||
        !['localhost', '127.0.0.1', '::1'].includes(
          process.env.DATABASE_HOST || '127.0.0.1')) {
      throw new ForbiddenException('Phase 2M audit is restricted to local kora_test');
    }
    return this.db.transaction('REPEATABLE READ', async manager => {
      await manager.query('SET TRANSACTION READ ONLY');
      const [identity] = await manager.query('SELECT current_database() AS name');
      if (identity?.name !== 'kora_test') {
        throw new ForbiddenException('Connected database is not kora_test');
      }
      // Consistent read-only snapshot. No repair/migration operations.
      const invoices = await manager.find(Invoice);
      const payments = await manager.find(Payment);
      const journals = await manager.find(JournalEntry, { relations: { lines: true } });
      const accounts = await manager.find(AccountingAccount);
      return auditPhase2M({ invoices, payments, journals, accounts }, new Date().toISOString());
    });
  }
}
