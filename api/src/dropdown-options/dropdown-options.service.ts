import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DropdownOption } from './entities/dropdown-option.entity';
import { CreateDropdownOptionDto } from './dto/create-dropdown-option.dto';

@Injectable()
export class DropdownOptionsService {
  constructor(
    @InjectRepository(DropdownOption)
    private readonly optionRepo: Repository<DropdownOption>,
  ) {}

  async findAll(category?: string): Promise<DropdownOption[]> {
    if (category) {
      return this.optionRepo.find({
        where: { category },
        order: { value: 'ASC' },
      });
    }
    return this.optionRepo.find({
      order: { category: 'ASC', value: 'ASC' },
    });
  }

  async findOne(id: number): Promise<DropdownOption> {
    const option = await this.optionRepo.findOne({ where: { id } });
    if (!option) {
      throw new NotFoundException(`Dropdown option with ID ${id} not found`);
    }
    return option;
  }

  async create(dto: CreateDropdownOptionDto): Promise<DropdownOption> {
    const trimmedValue = dto.value.trim();
    if (!trimmedValue) {
      throw new BadRequestException('Value cannot be empty or only whitespace');
    }

    const existing = await this.optionRepo.findOne({
      where: { category: dto.category, value: trimmedValue },
    });
    if (existing) {
      throw new BadRequestException(
        `Option "${trimmedValue}" already exists in category "${dto.category}"`,
      );
    }

    const option = this.optionRepo.create({
      category: dto.category,
      value: trimmedValue,
    });
    return this.optionRepo.save(option);
  }

  async update(id: number, dto: CreateDropdownOptionDto): Promise<DropdownOption> {
    const option = await this.findOne(id);
    const trimmedValue = dto.value.trim();
    if (!trimmedValue) {
      throw new BadRequestException('Value cannot be empty or only whitespace');
    }

    // Check if another option has the same value in this category
    const duplicate = await this.optionRepo.findOne({
      where: { category: dto.category, value: trimmedValue },
    });
    if (duplicate && duplicate.id !== id) {
      throw new BadRequestException(
        `Option "${trimmedValue}" already exists in category "${dto.category}"`,
      );
    }

    option.category = dto.category;
    option.value = trimmedValue;
    return this.optionRepo.save(option);
  }

  async remove(id: number): Promise<void> {
    const option = await this.findOne(id);
    await this.optionRepo.remove(option);
  }
}
