import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { SuspensionService } from './suspension.service';

@Module({ controllers: [AdminController], providers: [SuspensionService] })
export class AdminModule {}
