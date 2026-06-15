import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities/account.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
  ) {}

  async findAll(): Promise<Account[]> {
    return this.accountRepo.find({
      relations: { assignedSalesRep: true },
      order: { companyName: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Account> {
    const account = await this.accountRepo.findOne({
      where: { id },
      relations: { assignedSalesRep: true },
    });
    if (!account) throw new NotFoundException(`Account #${id} not found`);
    return account;
  }

  async generateNextAccountNumber(): Promise<string> {
    const lastAccount = await this.accountRepo.findOne({
      where: {},
      order: { id: 'DESC' },
    });

    let nextCounter = 1;
    if (lastAccount && lastAccount.accountNumber) {
      const parts = lastAccount.accountNumber.split('-');
      if (parts.length === 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num)) {
          nextCounter = num + 1;
        }
      }
    }

    return `ACC-${String(nextCounter).padStart(4, '0')}`;
  }

  async create(dto: CreateAccountDto): Promise<Account> {
    const accountNumber = await this.generateNextAccountNumber();
    const account = this.accountRepo.create({
      ...dto,
      accountNumber,
    });
    return this.accountRepo.save(account);
  }

  async update(id: number, dto: UpdateAccountDto): Promise<Account> {
    const account = await this.findOne(id);
    Object.assign(account, dto);
    return this.accountRepo.save(account);
  }

  async remove(id: number): Promise<void> {
    const account = await this.findOne(id);
    await this.accountRepo.remove(account);
  }
}
