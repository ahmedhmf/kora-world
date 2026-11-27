import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingAccount } from './entities/accounting-account.entity';
import { JournalEntry } from './entities/journal-entry.entity';
import { JournalLine } from './entities/journal-line.entity';
import { ExchangeRate } from './entities/exchange-rate.entity';
import { AccountingService } from './accounting.service';
import { AccountingPostingService } from './accounting-posting.service';
import { JournalWorkflowService } from './journal-workflow.service';
import { SimpleAccountingService } from './simple-accounting.service';
import { SimpleAccountingController } from './simple-accounting.controller';
import { ManualJournalsController } from './manual-journals.controller';
import { AccountingController } from './accounting.controller';
import { JournalService } from './journal.service';
import { JournalController } from './journal.controller';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { InvoicesModule } from '../invoices/invoices.module';
import { PaymentsModule } from '../payments/payments.module';
import { InvoicePaymentReconciliationService } from './invoice-payment-reconciliation.service';
import { InvoicePaymentReconciliationController } from './invoice-payment-reconciliation.controller';
import { Phase2JReportService } from './phase2j-report.service';
import { Phase2JReportController } from './phase2j-report.controller';
import { Phase2LBankService } from './phase2l-bank.service';
import { Phase2LBankController } from './phase2l-bank.controller';
import { Phase2MReadinessService } from './phase2m-readiness.service';
import { Phase2MReadinessController } from './phase2m-readiness.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountingAccount,
      JournalEntry,
      JournalLine,
      ExchangeRate,
    ]),
    forwardRef(() => InvoicesModule),
    forwardRef(() => PaymentsModule),
  ],
  controllers: [AccountingController, JournalController, ReportsController, ManualJournalsController, SimpleAccountingController, InvoicePaymentReconciliationController, Phase2JReportController, Phase2LBankController, Phase2MReadinessController],
  providers: [AccountingService, AccountingPostingService, JournalWorkflowService, SimpleAccountingService, JournalService, ReportsService, InvoicePaymentReconciliationService, Phase2JReportService, Phase2LBankService, Phase2MReadinessService],
  exports: [AccountingService, AccountingPostingService, JournalWorkflowService, JournalService, ReportsService, TypeOrmModule],
})
export class AccountingModule {}
