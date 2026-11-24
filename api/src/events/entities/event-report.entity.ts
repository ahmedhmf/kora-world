import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Event } from './event.entity';

@Entity('event_reports')
export class EventReport {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'event_id', type: 'int', unique: true }) eventId: number;
  @ManyToOne(() => Event, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'event_id' }) event: Event;
  @Column({ name: 'attendance', type: 'int', nullable: true }) attendance: number | null;
  @Column({ name: 'summary', type: 'text', default: '' }) summary: string;
  @Column({ name: 'successes', type: 'text', default: '' }) successes: string;
  @Column({ name: 'problems', type: 'text', default: '' }) problems: string;
  @Column({ name: 'missing_equipment', type: 'text', default: '' }) missingEquipment: string;
  @Column({ name: 'lessons_learned', type: 'text', default: '' }) lessonsLearned: string;
  @Column({ name: 'next_actions', type: 'text', default: '' }) nextActions: string;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
