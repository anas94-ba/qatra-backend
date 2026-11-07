import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/types';
import { NotificationsQueryDto } from './dto';
import { NotificationsService } from './notifications.service';

/** Notifications are polled, not real-time: the UI requests them on open and every 2–5 minutes */
@ApiTags('Notifications')
@ApiBearerAuth()
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
