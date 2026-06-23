import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { hashPassword, verifyPassword } from '../auth/crypto-auth.helper';

type MockRepository<T = unknown> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('UsersService', () => {
  let service: UsersService;
  let repository: MockRepository<User>;
  let mockUser: User;

  beforeEach(async () => {
    mockUser = {
      id: 1,
      email: 'test@example.com',
      password: hashPassword('Password123!'),
      name: 'Test User',
      role: 'employee',
      supplierId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    repository = {
      findOneBy: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn((user) => Promise.resolve({ ...user })),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByEmail', () => {
    it('should query lowercased and trimmed email', async () => {
      repository.findOneBy?.mockResolvedValue(mockUser);

      const result = await service.findByEmail('  TEST@Example.com  ');

      expect(repository.findOneBy).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user is not found', async () => {
      repository.findOneBy?.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return a list of users with select columns and ASC order', async () => {
      const mockUsers = [mockUser];
      repository.find?.mockResolvedValue(mockUsers);

      const result = await service.findAll();

      expect(repository.find).toHaveBeenCalledWith({
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
      expect(result).toEqual(mockUsers);
    });
  });

  describe('findOne', () => {
    it('should return user when found by ID', async () => {
      repository.findOne?.mockResolvedValue(mockUser);

      const result = await service.findOne(1);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
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
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user is not found', async () => {
      repository.findOne?.mockResolvedValue(null);

      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a user successfully', async () => {
      repository.findOneBy?.mockResolvedValue(null);
      repository.create?.mockReturnValue(mockUser);
      repository.save?.mockResolvedValue({ ...mockUser });

      const dto = {
        email: '  test@example.com  ',
        name: 'Test User',
        password: 'Password123!',
        role: 'employee',
        supplierId: undefined,
      };

      const result = await service.create(dto);

      expect(repository.findOneBy).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(repository.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        role: 'employee',
        supplierId: null,
        password: expect.any(String),
      });
      expect(repository.save).toHaveBeenCalled();
      expect(result.password).toBeUndefined();
    });

    it('should throw BadRequestException if email already exists', async () => {
      repository.findOneBy?.mockResolvedValue(mockUser);

      const dto = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'Password123!',
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if password is not provided', async () => {
      repository.findOneBy?.mockResolvedValue(null);

      const dto = {
        email: 'test@example.com',
        name: 'Test User',
        password: '',
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should throw NotFoundException if user is not found', async () => {
      repository.findOneBy?.mockResolvedValue(null);

      await expect(service.update(99, { name: 'New Name' })).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if email is updated to an existing email', async () => {
      repository.findOneBy?.mockImplementation((criteria) => {
        if (criteria.id === 1) return Promise.resolve(mockUser);
        if (criteria.email === 'existing@example.com') return Promise.resolve({ ...mockUser, email: 'existing@example.com' });
        return Promise.resolve(null);
      });

      await expect(service.update(1, { email: 'existing@example.com' })).rejects.toThrow(BadRequestException);
    });

    it('should update name, role (not supplier), and password successfully', async () => {
      const existingUser = { ...mockUser };
      repository.findOneBy?.mockImplementation((criteria) => {
        if (criteria.id === 1) return Promise.resolve(existingUser);
        return Promise.resolve(null);
      });

      const result = await service.update(1, {
        name: 'Updated Name',
        role: 'admin',
        password: 'NewPassword123!',
      });

      expect(existingUser.name).toBe('Updated Name');
      expect(existingUser.role).toBe('admin');
      expect(existingUser.supplierId).toBeNull();
      expect(verifyPassword('NewPassword123!', existingUser.password!)).toBe(true);
      expect(result.password).toBeUndefined();
    });

    it('should update role to supplier and handle supplierId', async () => {
      const existingUser = { ...mockUser };
      repository.findOneBy?.mockImplementation((criteria) => {
        if (criteria.id === 1) return Promise.resolve(existingUser);
        return Promise.resolve(null);
      });

      const result = await service.update(1, {
        role: 'supplier',
        supplierId: 42,
      });

      expect(existingUser.role).toBe('supplier');
      expect(existingUser.supplierId).toBe(42);
      expect(result.password).toBeUndefined();
    });

    it('should update supplierId directly when role is not changed', async () => {
      const existingUser = { ...mockUser };
      repository.findOneBy?.mockImplementation((criteria) => {
        if (criteria.id === 1) return Promise.resolve(existingUser);
        return Promise.resolve(null);
      });

      const result = await service.update(1, {
        supplierId: 100,
      });

      expect(existingUser.supplierId).toBe(100);
      expect(result.password).toBeUndefined();
    });

    it('should trim and lowercase email when updated to a non-existent email', async () => {
      const existingUser = { ...mockUser };
      repository.findOneBy?.mockImplementation((criteria) => {
        if (criteria.id === 1) return Promise.resolve(existingUser);
        if (criteria.email === 'new@example.com') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const result = await service.update(1, {
        email: '  NEW@Example.com  ',
      });

      expect(existingUser.email).toBe('new@example.com');
      expect(result.password).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('should throw BadRequestException when trying to delete own account', async () => {
      await expect(service.remove(1, 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user to remove does not exist', async () => {
      repository.findOneBy?.mockResolvedValue(null);

      await expect(service.remove(2, 1)).rejects.toThrow(NotFoundException);
    });

    it('should call remove on repository when successful', async () => {
      repository.findOneBy?.mockResolvedValue(mockUser);
      repository.remove?.mockResolvedValue(mockUser);

      await service.remove(2, 1);

      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 2 });
      expect(repository.remove).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('updatePassword', () => {
    it('should throw NotFoundException if user is not found', async () => {
      repository.findOne?.mockResolvedValue(null);

      await expect(service.updatePassword(99, 'current', 'new')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user password is not set', async () => {
      const noPassUser = { ...mockUser };
      delete noPassUser.password;
      repository.findOne?.mockResolvedValue(noPassUser);

      await expect(service.updatePassword(1, 'current', 'new')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if current password is incorrect', async () => {
      repository.findOne?.mockResolvedValue(mockUser);

      await expect(service.updatePassword(1, 'wrongPassword', 'newPassword')).rejects.toThrow(BadRequestException);
    });

    it('should save the hashed new password on success', async () => {
      const existingUser = { ...mockUser };
      repository.findOne?.mockResolvedValue(existingUser);

      await service.updatePassword(1, 'Password123!', 'NewPassword456!');

      expect(verifyPassword('NewPassword456!', existingUser.password!)).toBe(true);
      expect(repository.save).toHaveBeenCalledWith(existingUser);
    });
  });
});
