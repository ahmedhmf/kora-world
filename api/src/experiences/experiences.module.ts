import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../events/entities/event.entity';
import { KoraExperience, EventKoraExperience, EventKoraChecklist } from './experience.entity';
import { ExperiencesService } from './experiences.service';
import { ExperiencesController, EventExperiencesController } from './experiences.controller';

import { EventReservationsService } from './event-reservations.service';
import { EventReservationsController } from './event-reservations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Event, KoraExperience, EventKoraExperience, EventKoraChecklist])],
  providers: [ExperiencesService, EventReservationsService],
  controllers: [ExperiencesController, EventExperiencesController, EventReservationsController],
})
export class ExperiencesModule {}
