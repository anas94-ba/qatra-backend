import { Module } from '@nestjs/common';
import { AdminDeliveriesController, CampDeliveriesController, OrgDeliveriesController } from './deliveries.controller';
import { DeliveriesService } from './deliveries.service';

@Module({ controllers: [OrgDeliveriesController, CampDeliveriesController, AdminDeliveriesController], providers: [DeliveriesService] })
export class DeliveriesModule {}
