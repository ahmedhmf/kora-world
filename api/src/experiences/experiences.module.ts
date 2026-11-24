import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../events/entities/event.entity';
import { KoraExperience, EventKoraExperience, EventKoraChecklist } from './experience.entity';
import { ExperiencesService } from './experiences.service';
import { ExperiencesController, EventExperiencesController } from './experiences.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Event, KoraExperience, EventKoraExperience, EventKoraChecklist])],
  providers: [ExperiencesService],
  controllers: [ExperiencesController, EventExperiencesController],
})
export class ExperiencesModule {}
