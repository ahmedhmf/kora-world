import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventOfferFilesService } from './event-offer-files.service';

describe('EventOfferFilesService', () => {
  const events = { exists: jest.fn() };
  const offers = { findOneBy: jest.fn() };
  const files = { find: jest.fn(), findOneBy: jest.fn(), save: jest.fn(), create: jest.fn(), remove: jest.fn() };
  let service: EventOfferFilesService;

  beforeEach(() => {
    jest.clearAllMocks();
    events.exists.mockResolvedValue(true);
    offers.findOneBy.mockResolvedValue({ id: 10, eventId: 5, type: 'supplier' });
    files.find.mockResolvedValue([{ id: 11, offerId: 10, storedName: 'server.pdf',
      originalName: 'quotation.pdf', mimeType: 'application/pdf', sizeBytes: 52, createdAt: new Date() }]);
    service = new EventOfferFilesService(events as any, offers as any, files as any);
  });

  it('only returns safe file metadata without server storage names', async () => {
    const results = await service.list(5, 10);
    expect(results).toHaveLength(1);
    expect(results[0]).not.toHaveProperty('storedName');
    expect(results[0].originalName).toBe('quotation.pdf');
  });

  it('rejects attempts to attach files to staff offers', async () => {
    offers.findOneBy.mockResolvedValue({ id: 10, eventId: 5, type: 'staff' });
    await expect(service.list(5, 10)).rejects.toThrow(NotFoundException);
  });

  it('rejects file uploads with unsupported file types', async () => {
    await expect(service.upload(5, 10, {
      originalname: 'fake.exe', mimetype: 'application/octet-stream', size: 4, buffer: Buffer.from('test'),
    })).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid PDF signatures', async () => {
    await expect(service.upload(5, 10, {
      originalname: 'quotation.pdf', mimetype: 'application/pdf', size: 5, buffer: Buffer.from('hello'),
    })).rejects.toThrow(BadRequestException);
  });

  it('rejects files attached to an offer from another event', async () => {
    offers.findOneBy.mockResolvedValue(null);
    await expect(service.list(6, 10)).rejects.toThrow(NotFoundException);
    expect(offers.findOneBy).toHaveBeenCalledWith({ id: 10, eventId: 6 });
  });
});
