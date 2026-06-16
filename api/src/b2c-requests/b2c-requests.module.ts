import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { B2cRequest } from './entities/b2c-request.entity.js';
import { B2cRequestsService } from './b2c-requests.service.js';
import { B2cRequestsController } from './b2c-requests.controller.js';
import { DhlTrackingController } from './dhl-tracking.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([B2cRequest])],
  controllers: [B2cRequestsController, DhlTrackingController],
  providers: [B2cRequestsService],
  exports: [B2cRequestsService],
})
export class B2cRequestsModule {}
