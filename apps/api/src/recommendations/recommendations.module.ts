import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { AlgorithmConfigController, RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({ imports: [OrganizationsModule], controllers: [RecommendationsController, AlgorithmConfigController], providers: [RecommendationsService], exports: [RecommendationsService] })
export class RecommendationsModule {}
