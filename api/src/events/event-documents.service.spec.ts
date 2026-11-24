import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventDocumentsService } from './event-documents.service';

describe('EventDocumentsService', () => {
  const events = { exists: jest.fn() };
  const documents = { find: jest.fn(), findOneBy: jest.fn() };
  let service: EventDocumentsService;
  beforeEach(() => {
    jest.clearAllMocks();
    events.exists.mockResolvedValue(true);
    documents.find.mockResolvedValue([
      { id: 3, eventId: 1, category: 'permit', storedName: 'private.pdf', originalName: 'permit.pdf', sizeBytes: 24 },
    ]);
    service = new EventDocumentsService(events as any, documents as any);
  });
  it('hides internal filenames when listing documents', async () => {
    const result = await service.list(1);
    expect(result[0]).toMatchObject({ id: 3, originalName: 'permit.pdf' });
    expect(result[0]).not.toHaveProperty('storedName');
  });
  it('rejects uploads to non-existent events', async () => {
    events.exists.mockResolvedValue(false);
    await expect(service.upload(50, 'other')).rejects.toThrow(NotFoundException);
  });
  it('rejects invalid categories and spoofed file extensions', async () => {
    await expect(service.upload(1, 'unknown')).rejects.toThrow(BadRequestException);
    await expect(service.upload(1, 'contract', {
      originalname: 'unsafe.pdf', mimetype: 'application/pdf', size: 5, buffer: Buffer.from('hello'),
    })).rejects.toThrow(BadRequestException);
  });
  it('scopes file lookups to the correct event', async () => {
    documents.findOneBy.mockResolvedValue(null);
    await expect(service.download(8, 3)).rejects.toThrow(NotFoundException);
    expect(documents.findOneBy).toHaveBeenCalledWith({ id: 3, eventId: 8 });
  });
});
