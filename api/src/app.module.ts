import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Supplier } from './suppliers/entities/supplier.entity';
import { Product } from './products/entities/product.entity';
import { PurchaseOrder } from './purchase-orders/entities/purchase-order.entity';
import { PurchaseOrderLineItem } from './purchase-orders/entities/purchase-order-line-item.entity';
import { Prototype } from './prototypes/entities/prototype.entity';
import { User } from './users/entities/user.entity';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ProductsModule } from './products/products.module';
import { PrototypesModule } from './prototypes/prototypes.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AttachmentsModule } from './attachments/attachments.module';

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
        entities: [Supplier, Product, PurchaseOrder, PurchaseOrderLineItem, Prototype, User],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: true,
        synchronize: false,
        logging: config.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    SuppliersModule,
    ProductsModule,
    PrototypesModule,
    PurchaseOrdersModule,
    UsersModule,
    AuthModule,
    AttachmentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
