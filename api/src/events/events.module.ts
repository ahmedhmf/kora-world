import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './entities/event.entity';
import { EventOffer } from './entities/event-offer.entity';
import { EventOfferFile } from './entities/event-offer-file.entity';
import { EventOfferFilesService } from './event-offer-files.service';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { EventOffersService } from './event-offers.service';
import { EventOffersController } from './event-offers.controller';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Event, EventOffer, EventOfferFile, Supplier])],
  controllers: [EventsController, EventOffersController],
  providers: [EventsService, EventOffersService, EventOfferFilesService],
  exports: [EventsService],
})
export class EventsModule {}
