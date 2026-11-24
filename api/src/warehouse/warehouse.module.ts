import { Module } from '@nestjs/common';
import { WarehouseController } from './warehouse.controller';
import { WarehouseService } from './warehouse.service';

import { GoodsReceiptsController } from './goods-receipts.controller';
import { GoodsReceiptsService } from './goods-receipts.service';

@Module({
  controllers: [WarehouseController, GoodsReceiptsController],
  providers: [WarehouseService, GoodsReceiptsService],
  exports: [WarehouseService],
})
export class WarehouseModule {}
