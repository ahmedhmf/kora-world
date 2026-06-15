import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from './entities/contact.entity.js';
import { CreateContactDto } from './dto/create-contact.dto.js';
import { UpdateContactDto } from './dto/update-contact.dto.js';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
  ) {}

  async findAll(): Promise<Contact[]> {
    return this.contactRepo.find({
      relations: { supplier: true, account: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Contact> {
    const contact = await this.contactRepo.findOne({
      where: { id },
      relations: { supplier: true, account: true },
    });
    if (!contact) throw new NotFoundException(`Contact #${id} not found`);
    return contact;
  }

  async create(dto: CreateContactDto): Promise<Contact> {
    const contact = this.contactRepo.create(dto);
    return this.contactRepo.save(contact);
  }

  async update(id: number, dto: UpdateContactDto): Promise<Contact> {
    const contact = await this.findOne(id);
    Object.assign(contact, dto);
    
    if (dto.supplierId === null || dto.type !== 'supplier') {
      contact.supplierId = undefined;
      contact.supplier = undefined;
    }
    if (dto.accountId === null || dto.type !== 'account') {
      contact.accountId = undefined;
      contact.account = undefined;
    }
    return this.contactRepo.save(contact);
  }

  async remove(id: number): Promise<void> {
    const contact = await this.findOne(id);
    await this.contactRepo.remove(contact);
  }
}
