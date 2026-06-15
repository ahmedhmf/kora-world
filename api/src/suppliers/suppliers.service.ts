import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

import { SupplierContact } from './entities/supplier-contact.entity';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
  ) {}

  async findAll(): Promise<Supplier[]> {
    return this.supplierRepo.find({
      relations: { contacts: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Supplier> {
    const supplier = await this.supplierRepo.findOne({
      where: { id },
      relations: { products: true, contacts: true },
    });
    if (!supplier) throw new NotFoundException(`Supplier #${id} not found`);
    return supplier;
  }

  async create(dto: CreateSupplierDto): Promise<Supplier> {
    const supplier = this.supplierRepo.create(dto);
    return this.supplierRepo.save(supplier);
  }

  async update(id: number, dto: UpdateSupplierDto): Promise<Supplier> {
    const supplier = await this.findOne(id);
    const { contacts, ...rest } = dto;
    Object.assign(supplier, rest);

    if (contacts) {
      // Map contacts array for update/insert/delete cascading
      supplier.contacts = contacts.map((c) => {
        const existing = supplier.contacts?.find((ec) => ec.id === (c as any).id);
        if (existing) {
          Object.assign(existing, c);
          return existing;
        } else {
          const newContact = new SupplierContact();
          Object.assign(newContact, c);
          return newContact;
        }
      });
    }

    return this.supplierRepo.save(supplier);
  }

  async remove(id: number): Promise<void> {
    const supplier = await this.findOne(id);
    await this.supplierRepo.remove(supplier);
  }
}
