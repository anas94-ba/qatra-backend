import { Controller, Get, HttpException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import nodemailer from 'nodemailer';
import { MailService } from '../mail/mail.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService,private mail: MailService) {}

  @Public()
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', time: new Date().toISOString() };
  }

  @Public()
  @Get('test')
  async test() {
    const ok = await this.mail.send('anas2baba1994@gmail.com', {
      subject: 'Test email',
      html: '<p>If you received this message, the mail settings work.</p>',
    });

    return { ok };
  }
}
