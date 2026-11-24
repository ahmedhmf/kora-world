import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Event } from './entities/event.entity';
import { EventKoraChecklist, EventKoraExperience } from '../experiences/experience.entity';

@Injectable()
export class EventDuplicateService {
  constructor(private readonly db: DataSource) {}

  async duplicate(eventId: number, userId?: number) {
    return this.db.transaction(async manager => {
      const original = await manager.getRepository(Event).findOneBy({ id: eventId });
      if (!original) throw new NotFoundException('Event not found');
      // Start one week after the original while preserving event duration.
      const startDate = new Date(original.startDate.getTime() + 7 * 86400000);
      const endDate = original.endDate
        ? new Date(original.endDate.getTime() + 7 * 86400000) : undefined;
      const created = await manager.save(Event, manager.create(Event, {
        title: `${original.title} (Copy)`, description: original.description,
        category: original.category, startDate, endDate,
        location: original.location, createdById: userId,
      }));
      const assignments = await manager.getRepository(EventKoraExperience).find({ where: { eventId } });
      if (assignments.length) await manager.save(EventKoraExperience,
        assignments.map(a => manager.create(EventKoraExperience, {
          eventId: created.id, experienceId: a.experienceId,
        })));
      const checklist = await manager.getRepository(EventKoraChecklist).findOneBy({ eventId });
      if (checklist) {
        await manager.save(EventKoraChecklist, manager.create(EventKoraChecklist, {
          eventId: created.id,
          items: checklist.items.map(item => ({ ...item, sources: [...item.sources], packed: false })),
        }));
      }
      // Intentionally exclude documents, offers, actual costs and post-event reports.
      return created;
    });
  }
}
