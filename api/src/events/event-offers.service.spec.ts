import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventOffersService } from './event-offers.service';

describe('EventOffersService', () => {
  const eventRepo = { exist: jest.fn() };
  const offerRepo = {
    create: jest.fn((value: unknown) => value),
    save: jest.fn(async (value: unknown) => ({ id: 5, ...value as object })),
    find: jest.fn(async () => []),
    findOneBy: jest.fn(),
    remove: jest.fn(),
  };
  const supplierRepo = { exist: jest.fn() };
  let service: EventOffersService;

  beforeEach(() => {
    jest.clearAllMocks();
    eventRepo.exist.mockResolvedValue(true);
    supplierRepo.exist.mockResolvedValue(true);
    service = new EventOffersService(eventRepo as any, offerRepo as any, supplierRepo as any);
  });

  const staff = {
    type: 'staff', recipientName: 'Crew member', description: 'Setup and logistics',
    quantity: 3, unit: 'days', unitRate: '125.50', currency: 'EGP', status: 'draft',
  };

  it('creates a staff offer without an employee account and calculates exact integer cents', async () => {
    const offer = await service.create(8, staff);
    expect(offer.totalCents).toBe('37650');
    expect(offer.unitRateCents).toBe('12550');
    expect(offer.supplierId).toBeNull();
    expect(offer.eventId).toBe(8);
  });

  it('accepts an existing supplier reference and retains the original quoted currency', async () => {
    const offer = await service.create(8, { ...staff, type: 'supplier', supplierId: 12, currency: 'USD' });
    expect(offer.supplierId).toBe(12);
    expect(offer.currency).toBe('USD');
    expect(supplierRepo.exist).toHaveBeenCalledWith({ where: { id: 12 } });
  });

  it('rejects quantities, fractions and invalid statuses', async () => {
    await expect(service.create(8, { ...staff, quantity: 0 })).rejects.toThrow(BadRequestException);
    await expect(service.create(8, { ...staff, unitRate: '19.999' })).rejects.toThrow(BadRequestException);
    await expect(service.create(8, { ...staff, status: 'paid' })).rejects.toThrow(BadRequestException);
  });

  it('rejects attempts to update an offer from another event', async () => {
    offerRepo.findOneBy.mockResolvedValue(null);
    await expect(service.update(9, 5, staff)).rejects.toThrow(NotFoundException);
    expect(offerRepo.findOneBy).toHaveBeenCalledWith({ id: 5, eventId: 9 });
  });
});
