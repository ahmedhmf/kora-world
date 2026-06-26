import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Supplier } from './suppliers/entities/supplier.entity';
import { SupplierContact } from './suppliers/entities/supplier-contact.entity';
import { Product } from './products/entities/product.entity';
import { PurchaseOrder } from './purchase-orders/entities/purchase-order.entity';
import { PurchaseOrderLineItem } from './purchase-orders/entities/purchase-order-line-item.entity';
import { Sample } from './samples/entities/sample.entity';
import { User } from './users/entities/user.entity';
import { Event } from './events/entities/event.entity';
import { Account } from './accounts/entities/account.entity';
import { Receipt } from './receipts/entities/receipt.entity';
import { ReceiptLineItem } from './receipts/entities/receipt-line-item.entity';
import { Contact } from './contacts/entities/contact.entity';
import { B2cRequest } from './b2c-requests/entities/b2c-request.entity.js';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ProductsModule } from './products/products.module';
import { SamplesModule } from './samples/samples.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { EventsModule } from './events/events.module';
import { AccountsModule } from './accounts/accounts.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { ContactsModule } from './contacts/contacts.module';
import { B2cRequestsModule } from './b2c-requests/b2c-requests.module.js';

// Accounting, Invoices, Payments Imports
import { AccountingAccount } from './accounting/entities/accounting-account.entity';
import { ExchangeRate } from './accounting/entities/exchange-rate.entity';
import { JournalEntry } from './accounting/entities/journal-entry.entity';
import { JournalLine } from './accounting/entities/journal-line.entity';
import { Invoice } from './invoices/entities/invoice.entity';
import { InvoiceLine } from './invoices/entities/invoice-line.entity';
import { Payment } from './payments/entities/payment.entity';

import { AccountingModule } from './accounting/accounting.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { SourcingModule } from './sourcing/sourcing.module';
import { DropdownOption } from './dropdown-options/entities/dropdown-option.entity';
import { DropdownOptionsModule } from './dropdown-options/dropdown-options.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DATABASE_HOST'),
        port: config.get<number>('DATABASE_PORT'),
        username: config.get('DATABASE_USER'),
        password: config.get('DATABASE_PASSWORD'),
        database: config.get('DATABASE_NAME'),
        entities: [
          Supplier,
          SupplierContact,
          Product,
          PurchaseOrder,
          PurchaseOrderLineItem,
          Sample,
          User,
          Event,
          Account,
          Receipt,
          ReceiptLineItem,
          Contact,
          B2cRequest,
          AccountingAccount,
          ExchangeRate,
          JournalEntry,
          JournalLine,
          Invoice,
          InvoiceLine,
          Payment,
          DropdownOption,
        ],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: true,
        synchronize: false,
        logging: config.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    SuppliersModule,
    ProductsModule,
    SamplesModule,
    PurchaseOrdersModule,
    UsersModule,
    AuthModule,
    AttachmentsModule,
    EventsModule,
    AccountsModule,
    ReceiptsModule,
    ContactsModule,
    B2cRequestsModule,
    AccountingModule,
    InvoicesModule,
    PaymentsModule,
    SourcingModule,
    DropdownOptionsModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
