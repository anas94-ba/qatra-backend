import { Module } from '@nestjs/common';
import { AdminCampsController, CampController } from './camps.controller';
import { CampsService } from './camps.service';

@Module({ controllers: [CampController, AdminCampsController], providers: [CampsService], exports: [CampsService] })
export class CampsModule {}
