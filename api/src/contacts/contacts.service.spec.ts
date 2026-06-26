import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { Contact } from './entities/contact.entity.js';
import { CreateContactDto } from './dto/create-contact.dto.js';
import { UpdateContactDto } from './dto/update-contact.dto.js';

describe('ContactsService', () => {
  let service: ContactsService;

  const mockContactRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactsService,
        {
          provide: getRepositoryToken(Contact),
          useValue: mockContactRepo,
        },
      ],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return contacts with supplier and account relations', async () => {
      const mockContacts = [{ id: 1, name: 'Alice' }] as Contact[];
      mockContactRepo.find.mockResolvedValue(mockContacts);

      const result = await service.findAll();

      expect(result).toEqual(mockContacts);
      expect(mockContactRepo.find).toHaveBeenCalledWith({
        relations: { supplier: true, account: true },
        order: { name: 'ASC' },
      });
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return the contact when found', async () => {
      const mockContact = { id: 1, name: 'Alice' } as Contact;
      mockContactRepo.findOne.mockResolvedValue(mockContact);

      const result = await service.findOne(1);

      expect(result).toEqual(mockContact);
      expect(mockContactRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { supplier: true, account: true },
      });
    });

    it('should throw NotFoundException when contact is not found', async () => {
      mockContactRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create and save a contact', async () => {
      const dto: CreateContactDto = { name: 'Bob', type: 'supplier' } as CreateContactDto;
      const created = { id: 1, ...dto } as Contact;

      mockContactRepo.create.mockReturnValue(created);
      mockContactRepo.save.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(result).toEqual(created);
      expect(mockContactRepo.create).toHaveBeenCalledWith(dto);
      expect(mockContactRepo.save).toHaveBeenCalledWith(created);
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update fields and save', async () => {
      const existing = { id: 1, name: 'Old', type: 'account', supplierId: undefined, accountId: 5 } as unknown as Contact;
      mockContactRepo.findOne.mockResolvedValue(existing);
      mockContactRepo.save.mockImplementation((val: Contact) => Promise.resolve(val));

      const dto: UpdateContactDto = { name: 'New', type: 'account' } as UpdateContactDto;
      const result = await service.update(1, dto);

      expect(result.name).toBe('New');
      expect(mockContactRepo.save).toHaveBeenCalledWith(existing);
    });

    it('should clear supplierId when supplierId is null in dto', async () => {
      const existing = {
        id: 1, name: 'Alice', type: 'supplier', supplierId: 10, accountId: undefined,
      } as unknown as Contact;
      mockContactRepo.findOne.mockResolvedValue(existing);
      mockContactRepo.save.mockImplementation((val: Contact) => Promise.resolve(val));

      const dto: UpdateContactDto = { supplierId: null, type: 'account' } as unknown as UpdateContactDto;
      const result = await service.update(1, dto);

      expect(result.supplierId).toBeUndefined();
      expect(result.supplier).toBeUndefined();
    });

    it('should clear accountId when accountId is null in dto', async () => {
      const existing = {
        id: 1, name: 'Alice', type: 'account', supplierId: undefined, accountId: 5,
      } as unknown as Contact;
      mockContactRepo.findOne.mockResolvedValue(existing);
      mockContactRepo.save.mockImplementation((val: Contact) => Promise.resolve(val));

      const dto: UpdateContactDto = { accountId: null, type: 'supplier' } as unknown as UpdateContactDto;
      const result = await service.update(1, dto);

      expect(result.accountId).toBeUndefined();
      expect(result.account).toBeUndefined();
    });

    it('should throw NotFoundException if contact does not exist', async () => {
      mockContactRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update(99, { name: 'X' } as UpdateContactDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should remove the contact when found', async () => {
      const mockContact = { id: 1, name: 'Alice' } as Contact;
      mockContactRepo.findOne.mockResolvedValue(mockContact);
      mockContactRepo.remove.mockResolvedValue(mockContact);

      await service.remove(1);

      expect(mockContactRepo.remove).toHaveBeenCalledWith(mockContact);
    });

    it('should throw NotFoundException if contact does not exist', async () => {
      mockContactRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
