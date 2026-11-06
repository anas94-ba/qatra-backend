import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/types';
import { NotificationsQueryDto } from './dto';
import { NotificationsService } from './notifications.service';

/** الإشعارات بالجلب (polling) وليست لحظية: الواجهة تطلبها عند الفتح وكل 2–5 دقائق */
@Controller('notifications')
export class NotificationsController {
  constructor(private svc: NotificationsService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query() query: NotificationsQueryDto) {
    return this.svc.list(u.id, query);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() u: AuthUser) {
    return this.svc.unreadCount(u.id);
  }

  @Post('read-all')
  readAll(@CurrentUser() u: AuthUser) {
    return this.svc.markAllRead(u.id);
  }

  @Patch(':id/read')
  read(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.markRead(u.id, id);
  }
}
