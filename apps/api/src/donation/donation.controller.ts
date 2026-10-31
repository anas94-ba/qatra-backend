import { Body, Controller, Get, Put } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { DonationService } from './donation.service';
import { UpdateDonationLinkDto } from './dto';

@Roles(Role.ADMIN)
@Controller('admin/donation-link')
export class DonationController {
  constructor(private svc: DonationService) {}
  @Get() get() { return this.svc.get(); }
  @Put() update(@CurrentUser() u: AuthUser, @Body() dto: UpdateDonationLinkDto) { return this.svc.update(u, dto); }
}
