import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Controller('products')
@UseGuards(AuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('supplierId') supplierId?: number,
    @Query('category') category?: string,
  ) {
    if (req.user.role === 'supplier') {
      supplierId = req.user.supplierId ?? undefined;
    }
    const products = await this.productsService.findAll(supplierId, category);
    if (req.user.role === 'supplier') {
      products.forEach((p) => {
        delete p.landingPrice;
        delete p.onePcPrice;
        delete p.bulkPrice;
        delete p.pricepoint;
      });
    }
    return products;
  }

  @Get('next-counter')
  async getNextCounter(
    @Req() req: AuthenticatedRequest,
    @Query('collection') collection: string,
    @Query('year') year: string,
    @Query('category') category: string,
  ) {
    if (req.user.role === 'supplier') {
      throw new ForbiddenException(
        'Suppliers are not allowed to use naming counter generator',
      );
    }
    const nextCounter = await this.productsService.getNextCounter(
      collection,
      year ? parseInt(year, 10) : 0,
      category,
    );
    return { counter: nextCounter };
  }

  @Get(':id')
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const product = await this.productsService.findOne(id);
    if (req.user.role === 'supplier') {
      if (product.supplierId !== req.user.supplierId) {
        throw new ForbiddenException(
          'You do not have permission to view this product',
        );
      }
      delete product.landingPrice;
      delete product.onePcPrice;
      delete product.bulkPrice;
      delete product.pricepoint;
    }
    return product;
  }

  @Post()
  @Roles('admin', 'employee')
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Put(':id')
  @Roles('admin', 'employee')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'employee')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.remove(id);
  }
}
