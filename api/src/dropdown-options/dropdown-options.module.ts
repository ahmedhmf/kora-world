import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DropdownOption } from './entities/dropdown-option.entity';
import { DropdownOptionsService } from './dropdown-options.service';
import { DropdownOptionsController } from './dropdown-options.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DropdownOption])],
  controllers: [DropdownOptionsController],
  providers: [DropdownOptionsService],
  exports: [DropdownOptionsService],
})
export class DropdownOptionsModule {}
