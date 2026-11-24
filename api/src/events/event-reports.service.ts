import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './entities/event.entity';
import { EventReport } from './entities/event-report.entity';

@Injectable()
export class EventReportsService {
  constructor(
    @InjectRepository(Event) private readonly events: Repository<Event>,
    @InjectRepository(EventReport) private readonly reports: Repository<EventReport>,
  ) {}
  private async checkEvent(id: number) {
    if (!await this.events.exists({ where: { id } })) throw new NotFoundException('Event not found');
  }
  async get(eventId: number) {
    await this.checkEvent(eventId);
    return await this.reports.findOneBy({ eventId });
  }
  async save(eventId: number, input: unknown) {
    await this.checkEvent(eventId);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Invalid report');
    const value = input as Record<string, unknown>;
    const fields = ['summary', 'successes', 'problems', 'missingEquipment', 'lessonsLearned', 'nextActions'] as const;
    const normalized: Record<string, string | number | null> = {};
    for (const field of fields) {
      const text = value[field] ?? '';
      if (typeof text !== 'string' || text.length > 10000) throw new BadRequestException(`Invalid ${field}`);
      normalized[field] = text.trim();
    }
    if (value.attendance != null && (typeof value.attendance !== 'number' ||
      !Number.isSafeInteger(value.attendance) || value.attendance < 0 || value.attendance > 100000000)) {
      throw new BadRequestException('Invalid attendance');
    }
    normalized.attendance = typeof value.attendance === 'number' ? value.attendance : null;
    let report = await this.reports.findOneBy({ eventId });
    if (report) Object.assign(report, normalized);
    else report = this.reports.create({ ...normalized, eventId });
    return this.reports.save(report);
  }
}
