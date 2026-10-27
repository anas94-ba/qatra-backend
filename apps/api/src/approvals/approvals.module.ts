import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';

@Module({ imports: [OrganizationsModule], controllers: [ApprovalsController], providers: [ApprovalsService] })
export class ApprovalsModule {}
