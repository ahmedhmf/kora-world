import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';

import { ProductsModule } from '../products/products.module';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    TypeOrmModule.forFeature([Account]),
    ProductsModule,
    forwardRef(() => PurchaseOrdersModule),
  ],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
