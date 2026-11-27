import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { EventOffer } from './event-offer.entity';

@Entity('event_offer_files')
export class EventOfferFile {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'offer_id', type: 'integer' }) offerId: number;
  @ManyToOne(() => EventOffer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'offer_id' }) offer: EventOffer;
  @Column({ name: 'stored_name', type: 'varchar', length: 100 }) storedName: string;
  @Column({ name: 'original_name', type: 'varchar', length: 255 }) originalName: string;
  @Column({ name: 'mime_type', type: 'varchar', length: 120 }) mimeType: string;
  @Column({ name: 'size_bytes', type: 'integer' }) sizeBytes: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
