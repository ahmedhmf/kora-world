import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Prototype } from './entities/prototype.entity';
import { CreatePrototypeDto } from './dto/create-prototype.dto';
import { UpdatePrototypeDto } from './dto/update-prototype.dto';
import { SuppliersService } from '../suppliers/suppliers.service';

@Injectable()
export class PrototypesService {
  constructor(
    @InjectRepository(Prototype)
    private readonly prototypeRepo: Repository<Prototype>,
    private readonly suppliersService: SuppliersService,
  ) {}

  async findAll(): Promise<Prototype[]> {
    return this.prototypeRepo.find({
      relations: { supplier: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Prototype> {
    const prototype = await this.prototypeRepo.findOne({
      where: { id },
      relations: { supplier: true },
    });
    if (!prototype) throw new NotFoundException(`Prototype #${id} not found`);
    return prototype;
  }

  async create(dto: CreatePrototypeDto): Promise<Prototype> {
    // Validate supplier exists
    await this.suppliersService.findOne(dto.supplierId);
    const prototype = this.prototypeRepo.create(dto);
    return this.prototypeRepo.save(prototype);
  }

  async update(id: number, dto: UpdatePrototypeDto): Promise<Prototype> {
    const prototype = await this.findOne(id);
    if (dto.supplierId) {
      await this.suppliersService.findOne(dto.supplierId);
    }
    Object.assign(prototype, dto);
    return this.prototypeRepo.save(prototype);
  }

  async remove(id: number): Promise<void> {
    const prototype = await this.findOne(id);
    await this.prototypeRepo.remove(prototype);
  }
}
