import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { EventsService } from './events.service';
import { Event } from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

describe('EventsService', () => {
  let service: EventsService;

  const mockEventRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: getRepositoryToken(Event),
          useValue: mockEventRepo,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all events ordered by startDate ASC', async () => {
      const mockEvents = [{ id: 1, title: 'Trade Show' }] as Event[];
      mockEventRepo.find.mockResolvedValue(mockEvents);

      const result = await service.findAll();

      expect(result).toEqual(mockEvents);
      expect(mockEventRepo.find).toHaveBeenCalledWith({
        relations: { createdBy: true },
        order: { startDate: 'ASC' },
      });
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return the event when found', async () => {
      const mockEvent = { id: 1, title: 'Trade Show' } as Event;
      mockEventRepo.findOne.mockResolvedValue(mockEvent);

      const result = await service.findOne(1);

      expect(result).toEqual(mockEvent);
      expect(mockEventRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { createdBy: true },
      });
    });

    it('should throw NotFoundException when event is not found', async () => {
      mockEventRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create event with createdById from userId', async () => {
      const dto: CreateEventDto = { title: 'New Event', startDate: '2025-01-01' } as unknown as CreateEventDto;
      const created = { id: 1, title: 'New Event', createdById: 42 } as Event;

      mockEventRepo.create.mockReturnValue(created);
      mockEventRepo.save.mockResolvedValue(created);

      const result = await service.create(dto, 42);

      expect(result).toEqual(created);
      expect(mockEventRepo.create).toHaveBeenCalledWith({
        ...dto,
        createdById: 42,
      });
      expect(mockEventRepo.save).toHaveBeenCalledWith(created);
    });

    it('should create event without userId when not provided', async () => {
      const dto: CreateEventDto = { title: 'New Event', startDate: '2025-01-01' } as unknown as CreateEventDto;
      const created = { id: 1, title: 'New Event', createdById: undefined } as Event;

      mockEventRepo.create.mockReturnValue(created);
      mockEventRepo.save.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(result).toEqual(created);
      expect(mockEventRepo.create).toHaveBeenCalledWith({
        ...dto,
        createdById: undefined,
      });
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update event fields and save', async () => {
      const existing = { id: 1, title: 'Old Event' } as Event;
      mockEventRepo.findOne.mockResolvedValue(existing);
      mockEventRepo.save.mockImplementation((val: Event) => Promise.resolve(val));

      const dto: UpdateEventDto = { title: 'New Event' } as unknown as UpdateEventDto;
      const result = await service.update(1, dto);

      expect(result.title).toBe('New Event');
      expect(mockEventRepo.save).toHaveBeenCalledWith(existing);
    });

    it('should throw NotFoundException if event does not exist', async () => {
      mockEventRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update(99, { title: 'X' } as unknown as UpdateEventDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should remove the event when found', async () => {
      const mockEvent = { id: 1, title: 'Trade Show' } as Event;
      mockEventRepo.findOne.mockResolvedValue(mockEvent);
      mockEventRepo.remove.mockResolvedValue(mockEvent);

      await service.remove(1);

      expect(mockEventRepo.remove).toHaveBeenCalledWith(mockEvent);
    });

    it('should throw NotFoundException if event does not exist', async () => {
      mockEventRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
