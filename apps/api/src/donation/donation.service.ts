import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/types';
import { env } from '../config/env';
import { sanitizeText } from '../common/text';
import { MailService } from '../mail/mail.service';
import { templates } from '../mail/mail.templates';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateDonationLinkDto } from './dto';
import { normalizePhone, validateDonationLink } from './link-validation';

@Injectable()
export class DonationService {
  private readonly logger = new Logger(DonationService.name);
  constructor(private prisma: PrismaService, private audit: AuditService, private mail: MailService) {}

  get() {
    return this.prisma.donationLink.findFirst({ orderBy: { updatedAt: 'desc' } });
  }

  /** سجل واحد مفعّل في MVP: التغيير يتطلب إعادة مصادقة + AuditLog قبل/بعد + تنبيه بريدي لباقي الأدمنين */
  async update(u: AuthUser, dto: UpdateDonationLinkDto) {
    const admin = await this.prisma.user.findUnique({ where: { id: u.id } });
    if (!admin || !(await argon2.verify(admin.passwordHash, dto.password).catch(() => false))) throw new ForbiddenException('كلمة المرور غير صحيحة. إعادة المصادقة مطلوبة لتغيير الرابط.');
    const err = validateDonationLink({ linkType: dto.linkType, url: dto.url.trim(), whatsappNumber: dto.whatsappNumber }, env.donationAllowedDomains);
    if (err) throw new BadRequestException(err);

    const before = await this.get();
    const data = {
      linkType: dto.linkType, url: dto.url.trim(), whatsappNumber: dto.linkType === 'WHATSAPP' ? normalizePhone(dto.whatsappNumber) : null,
      receivingEntityName: sanitizeText(dto.receivingEntityName), description: sanitizeText(dto.description), isActive: dto.isActive, updatedById: u.id,
      lastVerifiedAt: new Date(), lastStatus: 'OK',
    };
    const after = await this.prisma.$transaction(async (tx) => {
      const rec = before ? await tx.donationLink.update({ where: { id: before.id }, data }) : await tx.donationLink.create({ data });
      await this.audit.log({ userId: u.id, action: 'UPDATE_DONATION_LINK', entity: 'DonationLink', entityId: rec.id, before, after: rec }, tx);
      return rec;
    });
    const others = await this.prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null, id: { not: u.id } }, select: { email: true } });
    await this.mail.sendMany(others.map((a) => a.email), templates.donationLinkChanged(admin.email));
    return after;
  }

  /** فحص دوري: الصيغة والنطاق دائمًا، والوصول الفعلي للمواقع الخارجية. تنبيه عند الفشل. */
  async verifyActiveLink() {
    const link = await this.prisma.donationLink.findFirst({ where: { isActive: true } });
    if (!link) return { checked: false };
    let status = 'OK';
    const formatErr = validateDonationLink({ linkType: link.linkType, url: link.url, whatsappNumber: link.whatsappNumber ?? undefined }, env.donationAllowedDomains);
    if (formatErr) status = `FORMAT_ERROR: ${formatErr}`;
    else if (link.linkType === 'EXTERNAL_SITE') {
      try {
        const res = await fetch(link.url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(8000) });
        if (res.status >= 400) status = `FAILED: HTTP ${res.status}`;
      } catch (e) {
        status = `FAILED: ${(e as Error).message}`;
      }
    }
    await this.prisma.donationLink.update({ where: { id: link.id }, data: { lastVerifiedAt: new Date(), lastStatus: status } });
    if (status !== 'OK' && link.lastStatus !== status) {
      const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null }, select: { email: true } });
      await this.mail.sendMany(admins.map((a) => a.email), templates.donationLinkFailing(status));
      this.logger.warn(`donation link check: ${status}`);
    }
    return { checked: true, status };
  }
}
