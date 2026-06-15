import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SuppliersService } from '../suppliers/suppliers.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly suppliersService: SuppliersService,
  ) {}

  async findAll(supplierId?: number, category?: string): Promise<Product[]> {
    const where: any = { isActive: true };
    if (supplierId) where.supplierId = supplierId;
    if (category) where.category = category;

    return this.productRepo.find({
      where,
      relations: { supplier: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: { supplier: true },
    });
    if (!product) throw new NotFoundException(`Product #${id} not found`);
    return product;
  }

  async findBySupplier(supplierId: number): Promise<Product[]> {
    return this.productRepo.find({
      where: { supplierId, isActive: true },
      order: { articleNumber: 'ASC' },
    });
  }

  async getNextCounter(collection: string, year: number, category: string): Promise<number> {
    const maxProduct = await this.productRepo
      .createQueryBuilder('product')
      .where('product.collection = :collection', { collection })
      .andWhere('product.year = :year', { year })
      .andWhere('product.category = :category', { category })
      .orderBy('product.articleCounter', 'DESC')
      .getOne();

    return maxProduct ? (maxProduct.articleCounter || 0) + 1 : 1;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    // Validate supplier exists
    await this.suppliersService.findOne(dto.supplierId);
    const product = this.productRepo.create(dto);

    // Auto-generate article number if collection, year, and category are specified
    if (dto.collection && dto.year && dto.category) {
      const counter = await this.getNextCounter(dto.collection, dto.year, dto.category);
      product.articleCounter = counter;

      const yearStr = String(dto.year).slice(-2);
      let catCode = 'OTH';
      if (dto.category === 'football') catCode = 'FB';
      else if (dto.category === 'handball') catCode = 'HB';
      else if (dto.category === 'lifestyle') catCode = 'APP';

      const counterStr = String(counter).padStart(4, '0');
      product.articleNumber = `${dto.collection}${yearStr}${counterStr}${catCode}`;
    }

    return this.productRepo.save(product);
  }

  async update(id: number, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    if (dto.supplierId) await this.suppliersService.findOne(dto.supplierId);
    Object.assign(product, dto);
    return this.productRepo.save(product);
  }

  async remove(id: number): Promise<void> {
    const product = await this.findOne(id);
    // Soft delete — just mark inactive
    product.isActive = false;
    await this.productRepo.save(product);
  }
}
