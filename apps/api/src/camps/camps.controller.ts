import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../common/decorators';
import { PaginationDto } from '../common/pagination';
import { AuthUser } from '../common/types';
import { NotificationsService } from '../notifications/notifications.service';
import { CampsService } from './camps.service';
import { CampsQueryDto, CreateCampDto, CreateSnapshotDto, ReviewSnapshotDto, SnapshotsQueryDto, UpdateCampDto, UpdateOwnCampDto } from './dto';

@Roles(Role.CAMP_REP)
@Controller('camp')
export class CampController {
  constructor(private svc: CampsService, private notifications: NotificationsService) {}

  @Get('me') me(@CurrentUser() u: AuthUser) { return this.svc.own(u); }
  @Patch('me') update(@CurrentUser() u: AuthUser, @Body() dto: UpdateOwnCampDto) { return this.svc.updateOwn(u, dto); }

  @Post('snapshots')
  async createSnapshot(@CurrentUser() u: AuthUser, @Body() dto: CreateSnapshotDto) {
    const snap = await this.svc.createSnapshot(u, dto);
    // notify admins that a Snapshot awaits review
    await this.notifications.notify(await this.notifications.adminIds(), { type: 'SNAPSHOT_SUBMITTED', title: 'Snapshot جديد للمراجعة', body: 'أرسل مخيم بيانات جديدة بانتظار الاعتماد.' });
    return snap;
  }
  @Get('snapshots') snapshots(@CurrentUser() u: AuthUser, @Query() query: PaginationDto) { return this.svc.listOwnSnapshots(u, query); }
}

@Roles(Role.ADMIN)
@Controller('admin')
export class AdminCampsController {
  constructor(private svc: CampsService, private notifications: NotificationsService) {}

  @Post('camps') create(@CurrentUser() u: AuthUser, @Body() dto: CreateCampDto) { return this.svc.create(u.id, dto); }
  @Get('camps') list(@Query() query: CampsQueryDto) { return this.svc.list(query); }
  @Patch('camps/:id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateCampDto) { return this.svc.update(u.id, id, dto); }

  @Get('snapshots')
  snapshots(@Query() query: SnapshotsQueryDto) { return this.svc.adminListSnapshots(query); }

  private notify = async (campId: string, ok: boolean, reason?: string) =>
    this.notifications.notify(await this.notifications.campUserIds(campId), {
      type: 'SNAPSHOT_REVIEWED',
      title: ok ? 'تم اعتماد بياناتك' : 'رُفض الـ Snapshot',
      body: ok ? 'اعتمد الأدمن بيانات المخيم الأخيرة.' : `سبب الرفض: ${reason}`,
    });

  @Post('snapshots/:id/approve') @HttpCode(200)
  approve(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.review(u.id, id, true, undefined, this.notify); }

  @Post('snapshots/:id/reject') @HttpCode(200)
  reject(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ReviewSnapshotDto) { return this.svc.review(u.id, id, false, dto.reason, this.notify); }
}
