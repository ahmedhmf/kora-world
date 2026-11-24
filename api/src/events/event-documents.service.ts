import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './entities/event.entity';
import { EventDocument } from './entities/event-document.entity';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { OfferUpload } from './event-offer-files.service';

@Injectable()
export class EventDocumentsService {
  private readonly dir = path.join(process.cwd(), 'uploads', 'event-documents');
  private readonly categories = ['contract', 'venue-plan', 'permit', 'invoice', 'photo', 'other'];

  constructor(
    @InjectRepository(Event) private readonly events: Repository<Event>,
    @InjectRepository(EventDocument) private readonly documents: Repository<EventDocument>,
  ) {}

  private async checkEvent(eventId: number) {
    if (!await this.events.exists({ where: { id: eventId } })) throw new NotFoundException('Event not found');
  }
  private view(d: EventDocument) {
    return { id: d.id, eventId: d.eventId, category: d.category, originalName: d.originalName,
      mimeType: d.mimeType, sizeBytes: d.sizeBytes, createdAt: d.createdAt };
  }
  async list(eventId: number) {
    await this.checkEvent(eventId);
    const docs = await this.documents.find({ where: { eventId }, order: { id: 'DESC' } });
    return docs.map(d => this.view(d));
  }
  async upload(eventId: number, category: string, file?: OfferUpload) {
    await this.checkEvent(eventId);
    if (!this.categories.includes(category)) throw new BadRequestException('Invalid document category');
    if (!file || !file.buffer || file.size === 0 || file.size > 15 * 1024 * 1024)
      throw new BadRequestException('Select a file up to 15 MB');
    const types: Record<string, string[]> = {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    };
    const name = path.basename(file.originalname).replace(/[\r\n]/g, '').slice(0, 255);
    const ext = path.extname(name).toLowerCase();
    if (!name || !types[file.mimetype]?.includes(ext)) throw new BadRequestException('Unsupported document type');
    const b = file.buffer;
    const valid = (ext === '.pdf' && b.subarray(0,5).toString() === '%PDF-')
      || (['.jpg','.jpeg'].includes(ext) && b[0] === 255 && b[1] === 216 && b[2] === 255)
      || (ext === '.png' && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
      || (ext === '.webp' && b.subarray(0,4).toString() === 'RIFF' && b.subarray(8,12).toString() === 'WEBP')
      || (['.docx','.xlsx'].includes(ext) && b.subarray(0,2).toString() === 'PK');
    if (!valid) throw new BadRequestException('File contents do not match type');
    await fs.mkdir(this.dir, { recursive: true });
    const storedName = randomUUID() + ext;
    const diskPath = path.join(this.dir, storedName);
    await fs.writeFile(diskPath, b, { flag: 'wx', mode: 0o600 });
    try {
      const doc = await this.documents.save(this.documents.create({
        eventId, category, originalName: name, storedName, mimeType: file.mimetype, sizeBytes: file.size,
      }));
      return this.view(doc);
    } catch (error) {
      await fs.unlink(diskPath).catch(() => undefined);
      throw error;
    }
  }
  async download(eventId: number, documentId: number) {
    await this.checkEvent(eventId);
    const doc = await this.documents.findOneBy({ id: documentId, eventId });
    if (!doc) throw new NotFoundException('Event document not found');
    const diskPath = path.join(this.dir, doc.storedName);
    try { await fs.access(diskPath); }
    catch { throw new NotFoundException('Document file missing on server'); }
    return { doc, diskPath };
  }
  async remove(eventId: number, documentId: number) {
    await this.checkEvent(eventId);
    const doc = await this.documents.findOneBy({ id: documentId, eventId });
    if (!doc) throw new NotFoundException('Event document not found');
    await this.documents.remove(doc);
    await fs.unlink(path.join(this.dir, doc.storedName)).catch(() => undefined);
    return { deleted: true };
  }
}
