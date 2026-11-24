import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './entities/event.entity';
import { EventOffer } from './entities/event-offer.entity';
import { EventOfferFile } from './entities/event-offer-file.entity';
import { EventDocument } from './entities/event-document.entity';
import { EventReport } from './entities/event-report.entity';
import { EventDocumentsService } from './event-documents.service';
import { EventReportsService } from './event-reports.service';
import { EventDuplicateService } from './event-duplicate.service';
import { EventOperationsController } from './event-operations.controller';
import { EventOfferFilesService } from './event-offer-files.service';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { EventOffersService } from './event-offers.service';
import { EventOffersController } from './event-offers.controller';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Event, EventOffer, EventOfferFile, EventDocument, EventReport, Supplier])],
  controllers: [EventsController, EventOffersController, EventOperationsController],
  providers: [EventsService, EventOffersService, EventOfferFilesService, EventDocumentsService, EventReportsService, EventDuplicateService],
  exports: [EventsService],
})
export class EventsModule {}
