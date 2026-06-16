import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { B2cRequest } from './entities/b2c-request.entity.js';
import { CreateB2cRequestDto } from './dto/create-b2c-request.dto.js';
import { UpdateB2cRequestDto } from './dto/update-b2c-request.dto.js';

@Injectable()
export class B2cRequestsService {
  constructor(
    @InjectRepository(B2cRequest)
    private readonly b2cRepo: Repository<B2cRequest>,
  ) {}

  async findAll(): Promise<B2cRequest[]> {
    return this.b2cRepo.find({
      relations: { product: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<B2cRequest> {
    const request = await this.b2cRepo.findOne({
      where: { id },
      relations: { product: true },
    });
    if (!request) throw new NotFoundException(`B2C Request #${id} not found`);
    return request;
  }

  async create(dto: CreateB2cRequestDto): Promise<B2cRequest> {
    const request = this.b2cRepo.create(dto);
    const saved = await this.b2cRepo.save(request);
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateB2cRequestDto): Promise<B2cRequest> {
    const request = await this.findOne(id);
    Object.assign(request, dto);
    if (dto.productId === null) {
      request.productId = undefined;
      request.product = undefined;
    }
    await this.b2cRepo.save(request);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const request = await this.findOne(id);
    await this.b2cRepo.remove(request);
  }
}
