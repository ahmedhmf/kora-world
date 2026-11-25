import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity';
import { InvoiceLine } from './entities/invoice-line.entity';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { ControlledSupplierInvoiceBookingService } from './controlled-supplier-invoice-booking.service';
import { ControlledSupplierInvoiceBookingController } from './controlled-supplier-invoice-booking.controller';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceLine]),
    forwardRef(() => AccountingModule),
  ],
  controllers: [InvoicesController, ControlledSupplierInvoiceBookingController],
  providers: [InvoicesService, ControlledSupplierInvoiceBookingService],
  exports: [InvoicesService, TypeOrmModule],
})
export class InvoicesModule {}
