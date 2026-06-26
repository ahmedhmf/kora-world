import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { SourcingService } from './sourcing.service';
import { SourcingQueryDto, SourcingResultDto } from './dto/sourcing.dto';

@Controller('sourcing')
@UseGuards(AuthGuard)
export class SourcingController {
  constructor(private readonly sourcingService: SourcingService) {}

  @Post('research')
  async research(@Body() query: SourcingQueryDto): Promise<SourcingResultDto> {
    return this.sourcingService.researchSuppliers(query);
  }
}
