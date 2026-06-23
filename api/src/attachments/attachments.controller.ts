import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Res,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import * as express from 'express';
import { AuthGuard } from '../auth/auth.guard';

interface UploadedFileDto {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

// Resolve uploads folder at the root of the project
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

@Controller('attachments')
export class AttachmentsController {
  @Post('upload')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: (
        diskStorage as unknown as (options: Record<string, unknown>) => unknown
      )({
        destination: UPLOAD_DIR,
        filename: (
          req: unknown,
          file: { originalname: string },
          cb: (error: Error | null, filename: string) => void,
        ) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname);
          cb(null, `${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 15 * 1024 * 1024, // 15MB limit
      },
    }),
  )
  uploadFile(@UploadedFile() file: UploadedFileDto) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return {
      name: file.originalname,
      path: file.filename,
    };
  }

  @Get('download/:filename')
  @UseGuards(AuthGuard)
  downloadFile(
    @Param('filename') filename: string,
    @Res() res: express.Response,
  ): void {
    // Validate filename to prevent path traversal vulnerability
    if (!/^[a-zA-Z0-9.\-_]+$/.test(filename)) {
      throw new BadRequestException('Invalid filename');
    }

    const filePath = path.join(UPLOAD_DIR, filename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    // Streams the file with its original file name resolved via HTTP headers if desired,
    // or let the browser handle it. sendFile is safe and efficient.
    res.sendFile(filePath);
  }

  @Get('public/:filename')
  servePublicFile(
    @Param('filename') filename: string,
    @Res() res: express.Response,
  ): void {
    // Validate filename to prevent path traversal vulnerability
    if (!/^[a-zA-Z0-9.\-_]+$/.test(filename)) {
      throw new BadRequestException('Invalid filename');
    }

    const filePath = path.join(UPLOAD_DIR, filename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    res.sendFile(filePath);
  }
}
