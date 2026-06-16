import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sample } from './entities/sample.entity';
import { CreateSampleDto } from './dto/create-sample.dto';
import { UpdateSampleDto } from './dto/update-sample.dto';
import { SuppliersService } from '../suppliers/suppliers.service';

@Injectable()
export class SamplesService {
  constructor(
    @InjectRepository(Sample)
    private readonly sampleRepo: Repository<Sample>,
    private readonly suppliersService: SuppliersService,
  ) {}

  async findAll(supplierId?: number): Promise<Sample[]> {
    const where: any = {};
    if (supplierId) {
      where.supplierId = supplierId;
    }
    return this.sampleRepo.find({
      where,
      relations: { supplier: true, parentSample: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Sample> {
    const sample = await this.sampleRepo.findOne({
      where: { id },
      relations: { supplier: { contacts: true }, parentSample: true },
    });
    if (!sample) throw new NotFoundException(`Sample #${id} not found`);
    return sample;
  }

  async findRoundsChain(id: number): Promise<Sample[]> {
    // 1. Walk up to find all ancestors
    const ancestors: Sample[] = [];
    let currentId: number | null | undefined = id;

    while (currentId) {
      const sample = await this.sampleRepo.findOne({
        where: { id: currentId },
        relations: { supplier: true },
      });
      if (!sample) break;
      ancestors.push(sample);
      currentId = sample.parentSampleId;
    }

    const root = ancestors[ancestors.length - 1];
    if (!root) throw new NotFoundException(`Sample #${id} not found`);

    // 2. Walk down to find all descendants of all ancestors
    const chainMap = new Map<number, Sample>();
    for (const ancestor of ancestors) {
      chainMap.set(ancestor.id, ancestor);
    }

    const queue = [...ancestors];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = await this.sampleRepo.find({
        where: { parentSampleId: current.id },
        relations: { supplier: true },
      });
      for (const child of children) {
        if (!chainMap.has(child.id)) {
          chainMap.set(child.id, child);
          queue.push(child);
        }
      }
    }

    return Array.from(chainMap.values()).sort((a, b) => {
      if (a.roundNumber !== b.roundNumber) {
        return a.roundNumber - b.roundNumber;
      }
      return a.id - b.id;
    });
  }

  async getNextCounter(collection: string, year: number, category: string): Promise<number> {
    const maxSample = await this.sampleRepo
      .createQueryBuilder('sample')
      .where('sample.collection = :collection', { collection })
      .andWhere('sample.year = :year', { year })
      .andWhere('sample.category = :category', { category })
      .orderBy('sample.articleCounter', 'DESC')
      .getOne();

    return maxSample ? (maxSample.articleCounter || 0) + 1 : 1;
  }

  async create(dto: CreateSampleDto): Promise<Sample> {
    // Validate supplier exists
    await this.suppliersService.findOne(dto.supplierId);
    const sample = this.sampleRepo.create(dto);

    // Auto-generate article number starting with SP
    const collection = dto.collection || 'SS';
    const year = dto.year || new Date().getFullYear();
    const yearStr = String(year).slice(-2);
    const category = dto.category || 'other';

    const counter = await this.getNextCounter(collection, year, category);
    sample.collection = collection;
    sample.year = year;
    sample.articleCounter = counter;

    let catCode = 'OTH';
    if (category === 'football') catCode = 'FB';
    else if (category === 'handball') catCode = 'HB';
    else if (category === 'lifestyle') catCode = 'APP';

    const counterStr = String(counter).padStart(4, '0');
    sample.articleNumber = `SP${collection}${yearStr}${counterStr}${catCode}`;

    console.log('[SamplesService] Creating sample entity:', {
      id: sample.id,
      name: sample.name,
      category: sample.category,
      year: sample.year,
      articleCounter: sample.articleCounter,
      articleNumber: sample.articleNumber
    });

    const saved = await this.sampleRepo.save(sample);
    console.log('[SamplesService] Saved sample in DB:', saved);
    return saved;
  }

  async update(id: number, dto: UpdateSampleDto): Promise<Sample> {
    const sample = await this.findOne(id);
    if (dto.supplierId) {
      await this.suppliersService.findOne(dto.supplierId);
    }
    Object.assign(sample, dto);
    return this.sampleRepo.save(sample);
  }

  async remove(id: number): Promise<void> {
    const sample = await this.findOne(id);
    await this.sampleRepo.remove(sample);
  }
}
