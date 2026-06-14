import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrototypesController } from './prototypes.controller';
import { PrototypesService } from './prototypes.service';
import { Prototype } from './entities/prototype.entity';
import { SuppliersModule } from '../suppliers/suppliers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Prototype]),
    SuppliersModule,
  ],
  controllers: [PrototypesController],
  providers: [PrototypesService],
  exports: [PrototypesService],
})
export class PrototypesModule {}
