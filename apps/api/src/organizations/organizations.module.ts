import { Module } from '@nestjs/common';
import { AdminOrgsController, OrgController } from './organizations.controller';
import { PlansService } from './plans.service';

@Module({ controllers: [OrgController, AdminOrgsController], providers: [PlansService], exports: [PlansService] })
export class OrganizationsModule {}
