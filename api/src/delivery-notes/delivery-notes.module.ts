import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerStatement } from './customer-statement.entity';
import { CustomerStatementsService } from './customer-statements.service';
import { DeliveryNote } from './delivery-note.entity';
import { CustomerPricingRule } from './customer-pricing-rule.entity';
import { SalesSettlement } from './sales-settlement.entity';
import { CustomerPayment } from './customer-payment.entity';
import { PaymentAllocation } from './payment-allocation.entity';
import { CustomerFinancialsService } from './customer-financials.service';
import { CustomerFinancialsController } from './customer-financials.controller';
import { InventoryAdjustment } from './inventory-adjustment.entity';
import { WeeklySalesReport } from './weekly-sales-report.entity';
import { Account } from '../accounts/entities/account.entity';
import { Product } from '../products/entities/product.entity';
import { DeliveryNotesController } from './delivery-notes.controller';
import { InventoryLedgerService } from './inventory-ledger.service';
import { DeliveryNotesService } from './delivery-notes.service';

@Module({
  imports: [TypeOrmModule.forFeature([DeliveryNote, WeeklySalesReport, InventoryAdjustment, CustomerPricingRule, SalesSettlement, CustomerPayment, PaymentAllocation, CustomerStatement, Account, Product])],
  controllers: [DeliveryNotesController, CustomerFinancialsController],
  providers: [DeliveryNotesService, CustomerFinancialsService, InventoryLedgerService, CustomerStatementsService],
})
export class DeliveryNotesModule {}
