import { Module } from '@nestjs/common';
import { AcademyController } from './academy.controller';

import { AcademyAdminController } from './academy-admin.controller';

@Module({ controllers: [AcademyController, AcademyAdminController] })
export class AcademyModule {}
