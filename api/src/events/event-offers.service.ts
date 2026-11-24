import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './entities/event.entity';
import { EventOffer, EventOfferStatus, EventOfferType } from './entities/event-offer.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';

type OfferInput = Record<string, unknown>;

@Injectable()
export class EventOffersService {
  constructor(
    @InjectRepository(Event) private readonly events: Repository<Event>,
    @InjectRepository(EventOffer) private readonly offers: Repository<EventOffer>,
    @InjectRepository(Supplier) private readonly suppliers: Repository<Supplier>,
  ) {}

  private async checkEvent(id: number): Promise<void> {
    if (!await this.events.exist({ where: { id } })) throw new NotFoundException('Event not found');
  }

  private text(value: unknown, field: string, length: number): string {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > length) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return value.trim();
  }

  private cents(value: unknown): bigint {
    if (typeof value !== 'string' || !/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/.test(value)) {
      throw new BadRequestException('Unit rate must be a positive decimal with up to two digits after the decimal point');
    }
    const [whole, decimal = ''] = value.split('.');
    return BigInt(whole) * 100n + BigInt((decimal + '00').slice(0, 2));
  }

  private async normalize(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Offer must be an object');
    }
    const v = value as OfferInput;
    if (v.type !== 'staff' && v.type !== 'supplier') throw new BadRequestException('Invalid offer type');
    const type = v.type as EventOfferType;
    if (!Number.isSafeInteger(v.quantity) || (v.quantity as number) < 1 || (v.quantity as number) > 100000) {
      throw new BadRequestException('Quantity must be an integer between 1 and 100000');
    }
    const quantity = v.quantity as number;
    const rate = this.cents(v.unitRate);
    const total = rate * BigInt(quantity);
    if (total > 9223372036854775807n) throw new BadRequestException('Offer total is too large');
    const currency = this.text(v.currency, 'currency', 3).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new BadRequestException('Currency must be a three-letter code');
    const status = (v.status ?? 'draft') as EventOfferStatus;
    if (!['draft', 'sent', 'accepted', 'rejected'].includes(status)) throw new BadRequestException('Invalid offer status');
    let supplierId: number | null = null;
    if (type === 'supplier' && v.supplierId != null) {
      if (!Number.isSafeInteger(v.supplierId) || (v.supplierId as number) < 1) throw new BadRequestException('Invalid supplier ID');
      supplierId = v.supplierId as number;
      if (!await this.suppliers.exist({ where: { id: supplierId } })) throw new BadRequestException('Supplier not found');
    }
    if (v.notes != null && (typeof v.notes !== 'string' || v.notes.length > 4000)) throw new BadRequestException('Invalid notes');
    return {
      type,
      recipientName: this.text(v.recipientName, 'recipient name', 160),
      supplierId,
      description: this.text(v.description, 'description', 200),
      quantity,
      unit: this.text(v.unit, 'unit', 32),
      unitRateCents: rate.toString(),
      totalCents: total.toString(),
      currency,
      status,
      notes: typeof v.notes === 'string' ? v.notes.trim() : null,
    };
  }

  private display(offer: EventOffer) {
    return {
      ...offer,
      // Keep monetary amounts as integer-cent strings to avoid floating-point errors.
      unitRateCents: String(offer.unitRateCents),
      totalCents: String(offer.totalCents),
    };
  }

  async list(eventId: number) {
    await this.checkEvent(eventId);
    const rows = await this.offers.find({ where: { eventId }, order: { id: 'DESC' } });
    return rows.map(row => this.display(row));
  }

  async create(eventId: number, value: unknown) {
    await this.checkEvent(eventId);
    const offer = this.offers.create({ ...(await this.normalize(value)), eventId });
    return this.display(await this.offers.save(offer));
  }

  async update(eventId: number, offerId: number, value: unknown) {
    await this.checkEvent(eventId);
    const offer = await this.offers.findOneBy({ id: offerId, eventId });
    if (!offer) throw new NotFoundException('Offer not found for this event');
    Object.assign(offer, await this.normalize(value));
    return this.display(await this.offers.save(offer));
  }

  async remove(eventId: number, offerId: number) {
    await this.checkEvent(eventId);
    const offer = await this.offers.findOneBy({ id: offerId, eventId });
    if (!offer) throw new NotFoundException('Offer not found for this event');
    await this.offers.remove(offer);
    return { deleted: true };
  }
}
