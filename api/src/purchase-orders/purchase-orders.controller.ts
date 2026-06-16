import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('purchase-orders')
@UseGuards(AuthGuard, RolesGuard)
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Get()
  findAll(@Req() req: any) {
    let supplierId: number | undefined;
    if (req.user.role === 'supplier') {
      supplierId = req.user.supplierId;
    }
    return this.purchaseOrdersService.findAll(supplierId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const po = await this.purchaseOrdersService.findOne(id);
    if (req.user.role === 'supplier' && po.supplierId !== req.user.supplierId) {
      throw new ForbiddenException('You do not have permission to view this purchase order');
    }
    return po;
  }

  @Post()
  @Roles('admin', 'employee')
  create(@Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrdersService.create(dto);
  }

  @Put(':id')
  @Roles('admin', 'employee')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'employee')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.purchaseOrdersService.remove(id);
  }
}
