import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

@Entity('exchange_rates')
@Unique(['fromCurrency', 'toCurrency', 'date'])
export class ExchangeRate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'from_currency', length: 10 })
  fromCurrency: string;

  @Column({ name: 'to_currency', length: 10 })
  toCurrency: string;

  @Column({ type: 'numeric', precision: 12, scale: 6 })
  rate: number;

  @Column({ type: 'date' })
  date: Date | string;

  @Column({ name: 'notes', length: 255, nullable: true })
  notes?: string;
}
