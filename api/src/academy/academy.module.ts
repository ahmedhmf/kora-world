import { Module } from '@nestjs/common';
import { AcademyController } from './academy.controller';

import { AcademyAdminController } from './academy-admin.controller';

import { AcademyLearningController } from './academy-learning.controller';

@Module({ controllers: [AcademyController, AcademyAdminController, AcademyLearningController] })
export class AcademyModule {}
