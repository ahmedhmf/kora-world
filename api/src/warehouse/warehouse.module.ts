import { Module } from '@nestjs/common';
import { WarehouseController } from './warehouse.controller';
import { WarehouseService } from './warehouse.service';

import { GoodsReceiptsController } from './goods-receipts.controller';
import { GoodsReceiptsService } from './goods-receipts.service';

import { EquipmentService } from './equipment.service';
import { EquipmentController } from './equipment.controller';

@Module({
  controllers: [WarehouseController, GoodsReceiptsController, EquipmentController],
  providers: [WarehouseService, GoodsReceiptsService, EquipmentService],
  exports: [WarehouseService],
})
export class WarehouseModule {}
