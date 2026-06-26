import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttachmentsController } from './attachments.controller';
import { AuthGuard } from '../auth/auth.guard';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Mock fs module so we don't touch the real file system
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

// Mock path to avoid OS-dependent behaviour
jest.mock('path', () => ({
  join: (...args: string[]) => args.join('/'),
  extname: (filename: string) => {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
  },
}));

import * as fs from 'fs';

const mockFs = fs as jest.Mocked<typeof fs>;

// ─── Stub for express Response ────────────────────────────────────────────────

function makeMockResponse() {
  return { sendFile: jest.fn() };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AttachmentsController', () => {
  let controller: AttachmentsController;

  beforeEach(async () => {
    // Ensure the upload directory "exists" during controller setup
    mockFs.existsSync.mockReturnValue(true);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttachmentsController],
      providers: [
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
      ],
    })
      // Override AuthGuard so it always allows (unit test scope)
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<AttachmentsController>(AttachmentsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── uploadFile ───────────────────────────────────────────────────────────

  describe('uploadFile', () => {
    it('should return name and path for a valid uploaded file', () => {
      const fakeFile = {
        fieldname: 'file',
        originalname: 'invoice.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 12345,
        destination: '/uploads',
        filename: '1234567890-invoice.pdf',
        path: '/uploads/1234567890-invoice.pdf',
        buffer: Buffer.from(''),
      };

      const result = controller.uploadFile(
        fakeFile as Parameters<typeof controller.uploadFile>[0],
      );

      expect(result).toEqual({
        name: 'invoice.pdf',
        path: '1234567890-invoice.pdf',
      });
    });

    it('should throw BadRequestException when no file is provided', () => {
      expect(() =>
        controller.uploadFile(undefined as unknown as Parameters<typeof controller.uploadFile>[0]),
      ).toThrow(BadRequestException);
    });
  });

  // ─── downloadFile ─────────────────────────────────────────────────────────

  describe('downloadFile', () => {
    it('should call res.sendFile with the correct path for a valid filename', () => {
      mockFs.existsSync.mockReturnValue(true);
      const res = makeMockResponse();

      controller.downloadFile('valid-file_123.pdf', res as unknown as import('express').Response);

      expect(res.sendFile).toHaveBeenCalled();
      const calledPath = (res.sendFile as jest.Mock).mock.calls[0][0] as string;
      expect(calledPath).toContain('valid-file_123.pdf');
    });

    it('should throw BadRequestException for filenames with path traversal characters', () => {
      const res = makeMockResponse();

      expect(() =>
        controller.downloadFile('../etc/passwd', res as unknown as import('express').Response),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for filenames with special characters', () => {
      const res = makeMockResponse();

      expect(() =>
        controller.downloadFile('file name with spaces.pdf', res as unknown as import('express').Response),
      ).toThrow(BadRequestException);
    });

    it('should throw NotFoundException when file does not exist on disk', () => {
      mockFs.existsSync.mockReturnValue(false);
      const res = makeMockResponse();

      expect(() =>
        controller.downloadFile('nonexistent.pdf', res as unknown as import('express').Response),
      ).toThrow(NotFoundException);
    });
  });

  // ─── servePublicFile ──────────────────────────────────────────────────────

  describe('servePublicFile', () => {
    it('should call res.sendFile for a valid public filename', () => {
      mockFs.existsSync.mockReturnValue(true);
      const res = makeMockResponse();

      controller.servePublicFile('logo.png', res as unknown as import('express').Response);

      expect(res.sendFile).toHaveBeenCalled();
      const calledPath = (res.sendFile as jest.Mock).mock.calls[0][0] as string;
      expect(calledPath).toContain('logo.png');
    });

    it('should throw BadRequestException for an invalid public filename', () => {
      const res = makeMockResponse();

      expect(() =>
        controller.servePublicFile('../../config.json', res as unknown as import('express').Response),
      ).toThrow(BadRequestException);
    });

    it('should throw NotFoundException when public file does not exist on disk', () => {
      mockFs.existsSync.mockReturnValue(false);
      const res = makeMockResponse();

      expect(() =>
        controller.servePublicFile('missing.png', res as unknown as import('express').Response),
      ).toThrow(NotFoundException);
    });
  });
});
