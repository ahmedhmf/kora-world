import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderLineItem } from './entities/purchase-order-line-item.entity';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { ProductsModule } from '../products/products.module';
import { AccountsModule } from '../accounts/accounts.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseOrder, PurchaseOrderLineItem]),
    SuppliersModule,
    ProductsModule,
    forwardRef(() => AccountsModule),
  ],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
