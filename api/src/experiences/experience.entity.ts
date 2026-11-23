import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Event } from '../events/entities/event.entity';

export type RequirementMode = 'sum' | 'shared';
export interface ExperienceRequirement {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  mode: RequirementMode;
  notes?: string;
}
export interface ChecklistRequirement extends ExperienceRequirement {
  key: string;
  packed: boolean;
  sources: string[];
}

@Entity('kora_experiences')
export class KoraExperience {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 160 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) items: ExperienceRequirement[];
  @Column({ type: 'boolean', default: true }) active: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}

@Entity('event_kora_experiences')
export class EventKoraExperience {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'event_id', type: 'int' }) eventId: number;
  @Column({ name: 'experience_id', type: 'int' }) experienceId: number;
  @ManyToOne(() => Event, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'event_id' }) event: Event;
  @ManyToOne(() => KoraExperience, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'experience_id' }) experience: KoraExperience;
}

@Entity('event_kora_checklists')
export class EventKoraChecklist {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'event_id', type: 'int', unique: true }) eventId: number;
  @ManyToOne(() => Event, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'event_id' }) event: Event;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) items: ChecklistRequirement[];
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
