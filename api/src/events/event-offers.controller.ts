import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards, UseInterceptors, UploadedFile, Res, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { EventOfferFilesService, OfferUpload } from './event-offer-files.service';
import { AuthGuard } from '../auth/auth.guard';
import { EventOffersService } from './event-offers.service';

@Controller('events/:eventId/offers')
@UseGuards(AuthGuard)
export class EventOffersController {
  constructor(
    private readonly service: EventOffersService,
    private readonly fileService: EventOfferFilesService,
  ) {}

  @Get()
  list(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.service.list(eventId);
  }

  @Post()
  create(@Param('eventId', ParseIntPipe) eventId: number, @Body() body: unknown) {
    return this.service.create(eventId, body);
  }

  @Put(':offerId')
  update(@Param('eventId', ParseIntPipe) eventId: number, @Param('offerId', ParseIntPipe) offerId: number, @Body() body: unknown) {
    return this.service.update(eventId, offerId, body);
  }

  @Get(':offerId/files')
  files(@Param('eventId', ParseIntPipe) eventId: number, @Param('offerId', ParseIntPipe) offerId: number) {
    return this.fileService.list(eventId, offerId);
  }

  @Post(':offerId/files')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  }))
  uploadFile(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Param('offerId', ParseIntPipe) offerId: number,
    @UploadedFile() file: OfferUpload | undefined,
  ) {
    if (!file) throw new BadRequestException('A file is required');
    return this.fileService.upload(eventId, offerId, file);
  }

  @Get(':offerId/files/:fileId/download')
  async downloadFile(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Param('offerId', ParseIntPipe) offerId: number,
    @Param('fileId', ParseIntPipe) fileId: number,
    @Res() response: Response,
  ) {
    const { file, diskPath } = await this.fileService.getForDownload(eventId, offerId, fileId);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.download(diskPath, file.originalName);
  }

  @Delete(':offerId/files/:fileId')
  removeFile(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Param('offerId', ParseIntPipe) offerId: number,
    @Param('fileId', ParseIntPipe) fileId: number,
  ) {
    return this.fileService.remove(eventId, offerId, fileId);
  }

  @Delete(':offerId')
  remove(@Param('eventId', ParseIntPipe) eventId: number, @Param('offerId', ParseIntPipe) offerId: number) {
    return this.service.remove(eventId, offerId);
  }
}
