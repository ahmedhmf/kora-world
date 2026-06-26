import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

@Entity('dropdown_options')
@Unique(['category', 'value'])
export class DropdownOption {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  category: string;

  @Column({ length: 150 })
  value: string;
}
