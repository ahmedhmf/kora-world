import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Event } from './event.entity';

@Entity('event_documents')
export class EventDocument {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'event_id', type: 'int' }) eventId: number;
  @ManyToOne(() => Event, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'event_id' }) event: Event;
  @Column({ type: 'varchar', length: 32 }) category: string;
  @Column({ name: 'original_name', type: 'varchar', length: 255 }) originalName: string;
  @Column({ name: 'stored_name', type: 'varchar', length: 100, unique: true }) storedName: string;
  @Column({ name: 'mime_type', type: 'varchar', length: 120 }) mimeType: string;
  @Column({ name: 'size_bytes', type: 'int' }) sizeBytes: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
