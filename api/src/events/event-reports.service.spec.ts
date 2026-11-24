import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventReportsService } from './event-reports.service';

describe('EventReportsService', () => {
  const events = { exists: jest.fn() };
  const reports = {
    findOneBy: jest.fn(), create: jest.fn((value: unknown) => value),
    save: jest.fn(async (value: unknown) => value),
  };
  let service: EventReportsService;
  beforeEach(() => {
    jest.clearAllMocks();
    events.exists.mockResolvedValue(true);
    reports.findOneBy.mockResolvedValue(null);
    service = new EventReportsService(events as any, reports as any);
  });
  it('saves reports for an existing event', async () => {
    const result = await service.save(4, {
      attendance: 60, summary: 'Community day', successes: 'Good turnout', problems: '',
      missingEquipment: '', lessonsLearned: 'Bring spare batteries', nextActions: '',
    });
    expect(result).toMatchObject({ eventId: 4, attendance: 60, summary: 'Community day' });
  });
  it('rejects invalid attendance and oversized fields', async () => {
    await expect(service.save(4, { attendance: -1 })).rejects.toThrow(BadRequestException);
    await expect(service.save(4, { attendance: 3.4 })).rejects.toThrow(BadRequestException);
    await expect(service.save(4, { summary: 'X'.repeat(10001) })).rejects.toThrow(BadRequestException);
  });
  it('rejects requests for missing events', async () => {
    events.exists.mockResolvedValue(false);
    await expect(service.get(99)).rejects.toThrow(NotFoundException);
  });
  it('updates the original report rather than creating another', async () => {
    reports.findOneBy.mockResolvedValue({ id: 7, eventId: 4, summary: 'Old' });
    const result = await service.save(4, { summary: 'New' });
    expect(result).toMatchObject({ id: 7, eventId: 4, summary: 'New' });
  });
});
