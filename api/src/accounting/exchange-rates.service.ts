import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExchangeRate } from './entities/exchange-rate.entity';

@Injectable()
export class ExchangeRatesService {
  constructor(
    @InjectRepository(ExchangeRate)
    private readonly rateRepo: Repository<ExchangeRate>,
  ) {}

  async getRate(fromCurrency: string, date: Date | string): Promise<number> {
    const from = fromCurrency.toUpperCase();
    if (from === 'EGP') return 1.0;

    const formattedDate = new Date(date).toISOString().split('T')[0];

    const rateRecord = await this.rateRepo
      .createQueryBuilder('rate')
      .where('rate.fromCurrency = :from', { from })
      .andWhere('rate.toCurrency = :to', { to: 'EGP' })
      .andWhere('rate.date <= :date', { date: formattedDate })
      .orderBy('rate.date', 'DESC')
      .getOne();

    if (rateRecord) {
      return Number(rateRecord.rate);
    }

    // fallback: check inverse rate
    const inverseRecord = await this.rateRepo
      .createQueryBuilder('rate')
      .where('rate.fromCurrency = :from', { from: 'EGP' })
      .andWhere('rate.toCurrency = :to', { to: from })
      .andWhere('rate.date <= :date', { date: formattedDate })
      .orderBy('rate.date', 'DESC')
      .getOne();

    if (inverseRecord) {
      return 1.0 / Number(inverseRecord.rate);
    }

    throw new BadRequestException(
      `No exchange rate found for ${from} on ${formattedDate}. Please add the rate first.`,
    );
  }

  async convertToEGP(
    amount: number,
    fromCurrency: string,
    date: Date | string,
  ): Promise<number> {
    const rate = await this.getRate(fromCurrency, date);
    return Number((amount * rate).toFixed(2));
  }

  async findAll(): Promise<ExchangeRate[]> {
    return this.rateRepo.find({
      order: { date: 'DESC' },
    });
  }

  async create(dto: {
    fromCurrency: string;
    toCurrency?: string;
    rate: number;
    date: Date | string;
    notes?: string;
  }): Promise<ExchangeRate> {
    const rate = this.rateRepo.create({
      fromCurrency: dto.fromCurrency.toUpperCase(),
      toCurrency: 'EGP',
      rate: dto.rate,
      date: new Date(dto.date),
      notes: dto.notes,
    });
    return this.rateRepo.save(rate);
  }

  async remove(id: number): Promise<void> {
    await this.rateRepo.delete(id);
  }
}
