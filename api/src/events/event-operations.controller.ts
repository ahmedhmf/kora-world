import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { AuthGuard } from '../auth/auth.guard';
import { EventDocumentsService } from './event-documents.service';
import { EventReportsService } from './event-reports.service';
import { EventDuplicateService } from './event-duplicate.service';
import type { OfferUpload } from './event-offer-files.service';

@Controller('events/:eventId')
@UseGuards(AuthGuard)
export class EventOperationsController {
  constructor(
    private readonly documents: EventDocumentsService,
    private readonly reports: EventReportsService,
    private readonly duplicator: EventDuplicateService,
  ) {}

  @Get('documents')
  listDocuments(@Param('eventId', ParseIntPipe) id: number) { return this.documents.list(id); }

  @Post('documents')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  }))
  uploadDocument(
    @Param('eventId', ParseIntPipe) id: number,
    @Body('category') category: string,
    @UploadedFile() file: OfferUpload | undefined,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.documents.upload(id, category, file);
  }

  @Get('documents/:documentId/download')
  async downloadDocument(
    @Param('eventId', ParseIntPipe) id: number,
    @Param('documentId', ParseIntPipe) documentId: number,
    @Res() res: Response,
  ) {
    const { doc, diskPath } = await this.documents.download(id, documentId);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.download(diskPath, doc.originalName);
  }

  @Delete('documents/:documentId')
  deleteDocument(@Param('eventId', ParseIntPipe) id: number,
    @Param('documentId', ParseIntPipe) documentId: number) {
    return this.documents.remove(id, documentId);
  }

  @Get('report')
  getReport(@Param('eventId', ParseIntPipe) id: number) {
    return this.reports.get(id);
  }

  @Put('report')
  saveReport(@Param('eventId', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.reports.save(id, body);
  }

  @Post('duplicate')
  duplicate(@Param('eventId', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    return this.duplicator.duplicate(id, req.user?.sub);
  }
}
