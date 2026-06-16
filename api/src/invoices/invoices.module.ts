import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity';
import { InvoiceLine } from './entities/invoice-line.entity';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceLine]),
    forwardRef(() => AccountingModule),
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService, TypeOrmModule],
})
export class InvoicesModule {}
