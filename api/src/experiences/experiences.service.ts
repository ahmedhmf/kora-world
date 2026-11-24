import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Event } from '../events/entities/event.entity';
import {
  ChecklistRequirement,
  EventKoraChecklist,
  EventKoraExperience,
  ExperienceRequirement,
  KoraExperience,
} from './experience.entity';

@Injectable()
export class ExperiencesService {
  constructor(
    @InjectRepository(Event) private readonly events: Repository<Event>,
    @InjectRepository(KoraExperience)
    private readonly experiences: Repository<KoraExperience>,
    @InjectRepository(EventKoraExperience)
    private readonly assignments: Repository<EventKoraExperience>,
    @InjectRepository(EventKoraChecklist)
    private readonly checklists: Repository<EventKoraChecklist>,
    private readonly dataSource: DataSource,
  ) {}

  private object(value: unknown): Record<string, any> {
    if (!value || Array.isArray(value) || typeof value !== 'object')
      throw new BadRequestException('Expected an object');
    return value as Record<string, any>;
  }

  private cleanItem(value: unknown): ExperienceRequirement {
    const v = this.object(value);
    const name = typeof v.name === 'string' ? v.name.trim() : '';
    const unit = typeof v.unit === 'string' ? v.unit.trim() : 'pcs';
    const category =
      typeof v.category === 'string' ? v.category.trim() : 'General';
    const quantity = Number(v.quantity);
    if (
      !name ||
      name.length > 160 ||
      !unit ||
      unit.length > 40 ||
      !category ||
      category.length > 80 ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 100000 ||
      !['sum', 'shared'].includes(v.mode ?? 'sum')
    ) {
      throw new BadRequestException(
        'Invalid requirement name, quantity, unit, category or combination mode',
      );
    }
    const notes =
      typeof v.notes === 'string' ? v.notes.trim().slice(0, 500) : '';
    if (v.inventoryKind != null && (!['product','equipment'].includes(v.inventoryKind) || !Number.isSafeInteger(v.inventoryId) || v.inventoryId < 1 || unit !== 'pcs')) throw new BadRequestException('Linked inventory requires a valid item and pcs unit');
    return {
      ...(v.inventoryKind ? { inventoryKind: v.inventoryKind, inventoryId: v.inventoryId } : {}),
      name,
      quantity,
      unit,
      category,
      mode: v.mode ?? 'sum',
      ...(notes ? { notes } : {}),
    };
  }

  private cleanExperience(value: unknown) {
    const v = this.object(value);
    const name = typeof v.name === 'string' ? v.name.trim() : '';
    if (
      !name ||
      name.length > 160 ||
      !Array.isArray(v.items) ||
      v.items.length > 200
    ) {
      throw new BadRequestException(
        'Name and an items array (max 200) are required',
      );
    }
    if (v.description != null && typeof v.description !== 'string')
      throw new BadRequestException('Invalid description');
    return {
      name,
      description:
        typeof v.description === 'string'
          ? v.description.trim().slice(0, 2000)
          : null,
      items: v.items.map((item: unknown) => this.cleanItem(item)),
      active: v.active === undefined ? true : v.active === true,
    };
  }

  private async requireUnreserved(id: number) {
    const [r] = await this.dataSource.query("SELECT id FROM event_stock_reservations WHERE event_id=$1 AND status='active' LIMIT 1",[id]);
    if(r) throw new BadRequestException('Cancel the stock reservation before editing the checklist');
  }

  private async requireEvent(id: number) {
    if (!(await this.events.exists({ where: { id } })))
      throw new NotFoundException('Event not found');
  }

  async list() {
    return this.experiences.find({ order: { name: 'ASC' } });
  }
  async create(value: unknown) {
    return this.experiences.save(
      this.experiences.create(this.cleanExperience(value)),
    );
  }
  async update(id: number, value: unknown) {
    const entity = await this.experiences.findOneBy({ id });
    if (!entity) throw new NotFoundException('Experience not found');
    Object.assign(entity, this.cleanExperience(value));
    return this.experiences.save(entity);
  }
  async remove(id: number) {
    const entity = await this.experiences.findOneBy({ id });
    if (!entity) throw new NotFoundException('Experience not found');
    await this.experiences.remove(entity);
    return { deleted: true };
  }

  async selected(eventId: number) {
    await this.requireEvent(eventId);
    const rows = await this.assignments.find({
      where: { eventId },
      order: { id: 'ASC' },
    });
    return rows.map((row) => row.experienceId);
  }

  async assign(eventId: number, experienceIds: unknown) {
    await this.requireEvent(eventId);
    await this.requireUnreserved(eventId);
    if (
      !Array.isArray(experienceIds) ||
      experienceIds.length > 100 ||
      experienceIds.some((id) => !Number.isSafeInteger(id) || id < 1)
    ) {
      throw new BadRequestException(
        'experienceIds must be an array of valid IDs',
      );
    }
    const ids = [...new Set(experienceIds as number[])];
    const found = ids.length
      ? await this.experiences.find({ where: { id: In(ids), active: true } })
      : [];
    if (found.length !== ids.length)
      throw new BadRequestException(
        'One or more experiences do not exist or are inactive',
      );
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(EventKoraExperience, { eventId });
      if (ids.length)
        await manager.save(
          EventKoraExperience,
          ids.map((experienceId) =>
            manager.create(EventKoraExperience, { eventId, experienceId }),
          ),
        );
    });
    return ids;
  }

  private key(item: ExperienceRequirement) {
    if (item.inventoryKind && item.inventoryId) return item.inventoryKind + ':' + item.inventoryId;
    return (
      item.name.trim().toLocaleLowerCase('en-US') +
      '|' +
      item.unit.trim().toLocaleLowerCase('en-US')
    );
  }

  async checklist(eventId: number) {
    await this.requireEvent(eventId);
    return (await this.checklists.findOneBy({ eventId }))?.items ?? [];
  }

  async generate(eventId: number) {
    await this.requireEvent(eventId);
    await this.requireUnreserved(eventId);
    const rows = await this.assignments.find({ where: { eventId } });
    const templates = rows.length
      ? await this.experiences.findBy({
          id: In(rows.map((r) => r.experienceId)),
        })
      : [];
    const previous = await this.checklist(eventId);
    const previousByKey = new Map(previous.map((item) => [item.key, item]));
    const items = new Map<string, ChecklistRequirement>();

    for (const experience of templates) {
      for (const requirement of experience.items) {
        const key = this.key(requirement);
        const found = items.get(key);
        if (found) {
          // Shared items need only the highest requirement, additive items are summed.
          found.quantity =
            found.mode === 'shared' && requirement.mode === 'shared'
              ? Math.max(found.quantity, requirement.quantity)
              : found.quantity + requirement.quantity;
          found.mode =
            found.mode === 'shared' && requirement.mode === 'shared'
              ? 'shared'
              : 'sum';
          if (!found.sources.includes(experience.name))
            found.sources.push(experience.name);
        } else {
          items.set(key, {
            ...requirement,
            key,
            packed: previousByKey.get(key)?.packed ?? false,
            sources: [experience.name],
          });
        }
      }
    }
    // Event-only additions survive regeneration.
    for (const previousItem of previous) {
      if (
        previousItem.sources.includes('Event-only') &&
        !items.has(previousItem.key)
      )
        items.set(previousItem.key, previousItem);
    }
    const saved = await this.checklists.findOneBy({ eventId });
    const result = [...items.values()].sort(
      (a, b) =>
        a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
    );
    await this.checklists.save(
      saved
        ? Object.assign(saved, { items: result })
        : this.checklists.create({ eventId, items: result }),
    );
    return result;
  }

  async addEventItem(eventId: number, value: unknown) {
    await this.requireEvent(eventId);
    await this.requireUnreserved(eventId);
    const requirement = this.cleanItem(value);
    const key = this.key(requirement);
    return this.dataSource.transaction(async (manager) => {
      let checklist = await manager
        .getRepository(EventKoraChecklist)
        .findOne({ where: { eventId }, lock: { mode: 'pessimistic_write' } });
      if (!checklist) {
        checklist = await manager
          .getRepository(EventKoraChecklist)
          .save(manager.create(EventKoraChecklist, { eventId, items: [] }));
      }
      if (checklist.items.some((item) => item.key === key))
        throw new BadRequestException(
          'This item already exists in the event checklist',
        );
      checklist.items.push({
        ...requirement,
        key,
        packed: false,
        sources: ['Event-only'],
      });
      await manager.save(checklist);
      return checklist.items;
    });
  }

  async setPacked(eventId: number, key: string, packed: unknown) {
    await this.requireEvent(eventId);
    if (typeof packed !== 'boolean')
      throw new BadRequestException('packed must be true or false');
    return this.dataSource.transaction(async (manager) => {
      const checklist = await manager
        .getRepository(EventKoraChecklist)
        .findOne({ where: { eventId }, lock: { mode: 'pessimistic_write' } });
      if (!checklist)
        throw new NotFoundException('Generate the event checklist first');
      const item = checklist.items.find((row) => row.key === key);
      if (!item) throw new NotFoundException('Checklist item not found');
      item.packed = packed;
      await manager.save(checklist);
      return checklist.items;
    });
  }
}
