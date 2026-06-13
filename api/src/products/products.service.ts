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

  async create(dto: CreateProductDto): Promise<Product> {
    // Validate supplier exists
    await this.suppliersService.findOne(dto.supplierId);
    const product = this.productRepo.create(dto);
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
