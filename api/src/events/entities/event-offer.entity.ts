import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Event } from './event.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';

export type EventOfferType = 'staff' | 'supplier';
export type EventOfferStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

@Entity('event_offers')
export class EventOffer {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'event_id', type: 'integer' }) eventId: number;
  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' }) event: Event;
  @Column({ type: 'varchar', length: 16 }) type: EventOfferType;
  @Column({ name: 'recipient_name', length: 160 }) recipientName: string;
  @Column({ name: 'supplier_id', type: 'integer', nullable: true }) supplierId: number | null;
  @ManyToOne(() => Supplier, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'supplier_id' }) supplier: Supplier | null;
  @Column({ type: 'varchar', length: 200 }) description: string;
  @Column({ type: 'integer' }) quantity: number;
  @Column({ type: 'varchar', length: 32 }) unit: string;
  @Column({ name: 'unit_rate_cents', type: 'bigint' }) unitRateCents: string;
  @Column({ name: 'total_cents', type: 'bigint' }) totalCents: string;
  @Column({ type: 'varchar', length: 3 }) currency: string;
  @Column({ type: 'varchar', length: 16, default: 'draft' }) status: EventOfferStatus;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
