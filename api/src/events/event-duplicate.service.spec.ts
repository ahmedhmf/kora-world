import { NotFoundException } from '@nestjs/common';
import { EventDuplicateService } from './event-duplicate.service';
import { Event } from './entities/event.entity';
import { EventKoraChecklist, EventKoraExperience } from '../experiences/experience.entity';

describe('EventDuplicateService', () => {
  const eventRepo = { findOneBy: jest.fn() };
  const assignmentRepo = { find: jest.fn() };
  const checklistRepo = { findOneBy: jest.fn() };
  const save = jest.fn(async (_entity: unknown, row: any) => {
    if (Array.isArray(row)) return row;
    if (row.title) return { ...row, id: 101 };
    return row;
  });
  const manager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Event) return eventRepo;
      if (entity === EventKoraExperience) return assignmentRepo;
      if (entity === EventKoraChecklist) return checklistRepo;
      throw new Error('Unexpected entity');
    }),
    create: jest.fn((_entity: unknown, row: unknown) => row),
    save,
  };
  const db = { transaction: jest.fn(async (cb: (m: typeof manager) => Promise<unknown>) => cb(manager)) };
  let service: EventDuplicateService;
  beforeEach(() => {
    jest.clearAllMocks();
    service = new EventDuplicateService(db as any);
    eventRepo.findOneBy.mockResolvedValue({
      id: 1, title: 'Demo', description: 'Description', category: 'other',
      location: 'Venue', startDate: new Date('2026-11-01T09:00:00Z'),
      endDate: new Date('2026-11-03T17:00:00Z'),
    });
    assignmentRepo.find.mockResolvedValue([{ eventId: 1, experienceId: 7 }]);
    checklistRepo.findOneBy.mockResolvedValue({
      items: [{ key: 'ball|pcs', name: 'Ball', packed: true, sources: ['Game'], quantity: 5 }],
    });
  });
  it('copies event dates and experiences but resets packing and does not copy old reports or offers', async () => {
    const result = await service.duplicate(1, 5);
    expect(result.id).toBe(101);
    expect(result.title).toBe('Demo (Copy)');
    expect(result.startDate.toISOString()).toBe('2026-11-08T09:00:00.000Z');
    expect(result.createdById).toBe(5);
    expect(save).toHaveBeenCalledWith(EventKoraExperience,
      expect.arrayContaining([expect.objectContaining({ eventId: 101, experienceId: 7 })]));
    expect(save).toHaveBeenCalledWith(EventKoraChecklist,
      expect.objectContaining({ eventId: 101, items: [expect.objectContaining({ packed: false })] }));
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });
  it('fails safely when the source event is missing', async () => {
    eventRepo.findOneBy.mockResolvedValue(null);
    await expect(service.duplicate(999)).rejects.toThrow(NotFoundException);
  });
});
