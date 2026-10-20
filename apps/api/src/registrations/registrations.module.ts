import { Module } from '@nestjs/common';
import { AdminRegistrationsController, RegistrationController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';

@Module({ controllers: [RegistrationController, AdminRegistrationsController], providers: [RegistrationsService], exports: [RegistrationsService] })
export class RegistrationsModule {}
