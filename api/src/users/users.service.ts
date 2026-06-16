import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { hashPassword, verifyPassword } from '../auth/crypto-auth.helper';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({
      email: email.toLowerCase().trim(),
    });
  }

  async findAll(): Promise<User[]> {
    // Select specific columns to securely exclude password hashes
    return this.usersRepository.find({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        supplierId: true,
        createdAt: true,
        updatedAt: true,
      },
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        supplierId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async create(dto: any): Promise<User> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new BadRequestException(
        'A user with this email address already exists',
      );
    }

    if (!dto.password) {
      throw new BadRequestException('Password is required');
    }

    const hashedPassword = hashPassword(dto.password);
    const user = this.usersRepository.create({
      email,
      name: dto.name,
      role: dto.role || 'employee',
      supplierId: dto.supplierId || null,
      password: hashedPassword,
    });

    const saved = await this.usersRepository.save(user);
    delete saved.password;
    return saved;
  }

  async update(id: number, dto: any): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (dto.email) {
      const email = dto.email.toLowerCase().trim();
      if (email !== user.email) {
        const existing = await this.findByEmail(email);
        if (existing) {
          throw new BadRequestException(
            'A user with this email address already exists',
          );
        }
        user.email = email;
      }
    }

    if (dto.name) {
      user.name = dto.name;
    }

    if (dto.role) {
      user.role = dto.role;
      if (dto.role === 'supplier') {
        user.supplierId = dto.supplierId || null;
      } else {
        user.supplierId = null;
      }
    } else if (dto.supplierId !== undefined) {
      user.supplierId = dto.supplierId;
    }

    if (dto.password && dto.password.trim() !== '') {
      user.password = hashPassword(dto.password);
    }

    const saved = await this.usersRepository.save(user);
    delete saved.password;
    return saved;
  }

  async remove(id: number, currentUserId: number): Promise<void> {
    if (id === currentUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    await this.usersRepository.remove(user);
  }

  async updatePassword(id: number, currentPass: string, newPass: string): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { id },
      select: {
        id: true,
        password: true,
      },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (!user.password) {
      throw new BadRequestException('Current password is not set');
    }

    const isValid = verifyPassword(currentPass, user.password);
    if (!isValid) {
      throw new BadRequestException('Incorrect current password');
    }

    user.password = hashPassword(newPass);
    await this.usersRepository.save(user);
  }
}
