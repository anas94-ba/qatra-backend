import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DonationModule } from '../donation/donation.module';
import { JobsService } from './jobs.service';

@Module({ imports: [ScheduleModule.forRoot(), DonationModule], providers: [JobsService], exports: [JobsService] })
export class JobsModule {}
