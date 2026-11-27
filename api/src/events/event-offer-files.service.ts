import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './entities/event.entity';
import { EventOffer } from './entities/event-offer.entity';
import { EventOfferFile } from './entities/event-offer-file.entity';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface OfferUpload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class EventOfferFilesService {
  private readonly dir = path.join(process.cwd(), 'uploads', 'event-offers');

  constructor(
    @InjectRepository(Event) private readonly events: Repository<Event>,
    @InjectRepository(EventOffer) private readonly offers: Repository<EventOffer>,
    @InjectRepository(EventOfferFile) private readonly files: Repository<EventOfferFile>,
  ) {}

  private async requireSupplierOffer(eventId: number, offerId: number): Promise<void> {
    if (!await this.events.exists({ where: { id: eventId } })) throw new NotFoundException('Event not found');
    const offer = await this.offers.findOneBy({ id: offerId, eventId });
    if (!offer || offer.type !== 'supplier') throw new NotFoundException('Supplier quotation not found for this event');
  }

  async list(eventId: number, offerId: number) {
    await this.requireSupplierOffer(eventId, offerId);
    return this.files.find({ where: { offerId }, order: { createdAt: 'DESC', id: 'DESC' } })
      .then(files => files.map(({ id, offerId, originalName, mimeType, sizeBytes, createdAt }) =>
        ({ id, offerId, originalName, mimeType, sizeBytes, createdAt })));
  }

  async upload(eventId: number, offerId: number, file: OfferUpload | undefined) {
    await this.requireSupplierOffer(eventId, offerId);
    if (!file || !file.buffer || file.buffer.length === 0 || file.size > 15 * 1024 * 1024) {
      throw new BadRequestException('Select a file up to 15 MB');
    }

    const types: Record<string, string[]> = {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    };
    const name = path.basename(file.originalname).replace(/[\r\n]/g, '').slice(0, 255);
    const ext = path.extname(name).toLowerCase();
    if (!name || !types[file.mimetype]?.includes(ext)) {
      throw new BadRequestException('Supported types: PDF, JPG, PNG, WEBP, DOCX, XLSX');
    }
    // Verify common signatures instead of trusting only the browser supplied MIME type.
    const bytes = file.buffer;
    const pdf = ext === '.pdf' && bytes.subarray(0, 5).toString() === '%PDF-';
    const jpg = (ext === '.jpg' || ext === '.jpeg') && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = ext === '.png' && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const webp = ext === '.webp' && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
    const office = (ext === '.docx' || ext === '.xlsx') && bytes.subarray(0, 2).toString() === 'PK';
    if (!(pdf || jpg || png || webp || office)) throw new BadRequestException('File contents do not match the selected type');

    await fs.mkdir(this.dir, { recursive: true });
    const storedName = randomUUID() + ext;
    const diskPath = path.join(this.dir, storedName);
    await fs.writeFile(diskPath, bytes, { flag: 'wx', mode: 0o600 });
    try {
      const saved = await this.files.save(this.files.create({
        offerId, storedName, originalName: name, mimeType: file.mimetype, sizeBytes: file.size,
      }));
      return { id: saved.id, offerId, originalName: saved.originalName, mimeType: saved.mimeType, sizeBytes: saved.sizeBytes, createdAt: saved.createdAt };
    } catch (error) {
      await fs.unlink(diskPath).catch(() => undefined);
      throw error;
    }
  }

  async getForDownload(eventId: number, offerId: number, fileId: number) {
    await this.requireSupplierOffer(eventId, offerId);
    const file = await this.files.findOneBy({ id: fileId, offerId });
    if (!file) throw new NotFoundException('Quotation attachment not found');
    const diskPath = path.join(this.dir, file.storedName);
    try { await fs.access(diskPath); }
    catch { throw new NotFoundException('Quotation file missing on server'); }
    return { file, diskPath };
  }

  async remove(eventId: number, offerId: number, fileId: number) {
    await this.requireSupplierOffer(eventId, offerId);
    const file = await this.files.findOneBy({ id: fileId, offerId });
    if (!file) throw new NotFoundException('Quotation attachment not found');
    await this.files.remove(file);
    await fs.unlink(path.join(this.dir, file.storedName)).catch(() => undefined);
    return { deleted: true };
  }
}
