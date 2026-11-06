import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/types';
import { inGaza } from '../common/geo';
import { PaginationDto, paginate } from '../common/pagination';
import { sanitizeText } from '../common/text';
import { PrismaService } from '../prisma/prisma.service';
import { CampsQueryDto, CreateCampDto, CreateSnapshotDto, SnapshotsQueryDto, UpdateCampDto, UpdateOwnCampDto } from './dto';

@Injectable()
export class CampsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private checkCoords(lat: number, lng: number) {
    if (!inGaza(lat, lng)) throw new BadRequestException('الإحداثيات خارج نطاق قطاع غزة');
  }

  // ───────── الأدمن ─────────
  async create(adminId: string, dto: CreateCampDto) {
    this.checkCoords(dto.lat, dto.lng);
    const name = sanitizeText(dto.name);
    if (await this.prisma.camp.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null } })) throw new ConflictException('يوجد مخيم بنفس الاسم');
    const camp = await this.prisma.camp.create({ data: { name, region: sanitizeText(dto.region), lat: dto.lat, lng: dto.lng, publicVisible: dto.publicVisible ?? false } });
    await this.audit.log({ userId: adminId, action: 'CREATE', entity: 'Camp', entityId: camp.id, after: camp });
    return camp;
  }

  async update(adminId: string, id: string, dto: UpdateCampDto) {
    const before = await this.prisma.camp.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('المخيم غير موجود');
    const lat = dto.lat ?? before.lat;
    const lng = dto.lng ?? before.lng;
    this.checkCoords(lat, lng);
    const after = await this.prisma.camp.update({
      where: { id },
      data: { name: dto.name ? sanitizeText(dto.name) : undefined, region: dto.region ? sanitizeText(dto.region) : undefined, lat, lng, publicVisible: dto.publicVisible },
    });
    await this.audit.log({ userId: adminId, action: 'UPDATE', entity: 'Camp', entityId: id, before, after });
    return after;
  }

  list(q: CampsQueryDto) {
    const where: Prisma.CampWhereInput = {
      deletedAt: null,
      status: q.status,
      region: q.region || undefined,
      name: q.q ? { contains: q.q, mode: 'insensitive' } : undefined,
    };
    return paginate(
      this.prisma,
      q,
      (window) => this.prisma.camp.findMany({ where, orderBy: { name: 'asc' }, ...window }),
      () => this.prisma.camp.count({ where }),
    );
  }

  // ───────── مدير المخيم ─────────
  private campIdOf(u: AuthUser) {
    if (!u.campId) throw new ForbiddenException('الحساب غير مرتبط بمخيم');
    return u.campId;
  }

  async own(u: AuthUser) {
    const camp = await this.prisma.camp.findFirst({ where: { id: this.campIdOf(u), deletedAt: null } });
    if (!camp) throw new NotFoundException('المخيم غير موجود');
    return camp;
  }

  async updateOwn(u: AuthUser, dto: UpdateOwnCampDto) {
    const before = await this.own(u);
    const lat = dto.lat ?? before.lat;
    const lng = dto.lng ?? before.lng;
    this.checkCoords(lat, lng);
    const after = await this.prisma.camp.update({ where: { id: before.id }, data: { region: dto.region ? sanitizeText(dto.region) : undefined, lat, lng } });
    await this.audit.log({ userId: u.id, action: 'UPDATE', entity: 'Camp', entityId: before.id, before, after });
    return after;
  }

  // ───────── Snapshots ─────────
  /** Snapshot جديد يبدأ PENDING ولا يدخل حساب الخوارزمية قبل اعتماد الأدمن (TC35) */
  async createSnapshot(u: AuthUser, dto: CreateSnapshotDto) {
    const campId = this.campIdOf(u);
    const errors: string[] = [];
    if (dto.children > dto.population) errors.push('عدد الأطفال لا يتجاوز عدد السكان');
    if (dto.disabled > dto.population) errors.push('عدد ذوي الإعاقة لا يتجاوز عدد السكان');
    if (dto.families > dto.population) errors.push('عدد الأسر لا يتجاوز عدد السكان');
    if (new Date(dto.reportedAt).getTime() > Date.now() + 5 * 60_000) errors.push('تاريخ التقرير لا يكون في المستقبل');
    if (dto.lastDistributionAt && new Date(dto.lastDistributionAt).getTime() > Date.now() + 86_400_000) errors.push('تاريخ آخر توزيع لا يكون في المستقبل');
    if (errors.length) throw new BadRequestException({ message: 'بيانات غير صحيحة', errors });
    const snap = await this.prisma.campSnapshot.create({
      data: {
        campId, families: dto.families, population: dto.population, children: dto.children, disabled: dto.disabled, waterReceivedLiters: dto.waterReceivedLiters,
        lastDistributionAt: dto.lastDistributionAt ? new Date(dto.lastDistributionAt.slice(0, 10) + 'T00:00:00.000Z') : null,
        otherSources: dto.otherSources ? sanitizeText(dto.otherSources) : null, reportedAt: new Date(dto.reportedAt), source: sanitizeText(dto.source), createdById: u.id,
      },
    });
    await this.audit.log({ userId: u.id, action: 'CREATE', entity: 'CampSnapshot', entityId: snap.id, after: snap });
    return snap;
  }

  listOwnSnapshots(u: AuthUser, q: PaginationDto) {
    const where: Prisma.CampSnapshotWhereInput = { campId: this.campIdOf(u) };
    return paginate(
      this.prisma,
      q,
      (window) => this.prisma.campSnapshot.findMany({ where, orderBy: { reportedAt: 'desc' }, ...window }),
      () => this.prisma.campSnapshot.count({ where }),
    );
  }

  adminListSnapshots(q: SnapshotsQueryDto) {
    const where: Prisma.CampSnapshotWhereInput = { reviewStatus: q.reviewStatus, campId: q.campId || undefined };
    return paginate(
      this.prisma,
      q,
      (window) => this.prisma.campSnapshot.findMany({ where, include: { camp: { select: { id: true, name: true, region: true } } }, orderBy: { createdAt: 'desc' }, ...window }),
      () => this.prisma.campSnapshot.count({ where }),
    );
  }

  async review(adminId: string, id: string, approve: boolean, reason?: string, notify?: (campId: string, ok: boolean, reason?: string) => Promise<void>) {
    const snap = await this.prisma.campSnapshot.findUnique({ where: { id } });
    if (!snap) throw new NotFoundException('الـ Snapshot غير موجود');
    const cleanReason = reason ? sanitizeText(reason) : '';
    if (!approve && cleanReason.length < 3) throw new BadRequestException('سبب الرفض إلزامي');
    const claimed = await this.prisma.campSnapshot.updateMany({
      where: { id, reviewStatus: 'PENDING' },
      data: { reviewStatus: approve ? 'APPROVED' : 'REJECTED', rejectionReason: approve ? null : cleanReason, reviewedById: adminId, reviewedAt: new Date() },
    });
    if (claimed.count === 0) throw new ConflictException('تمت مراجعة هذا الـ Snapshot مسبقًا');
    await this.audit.log({ userId: adminId, action: approve ? 'APPROVE' : 'REJECT', entity: 'CampSnapshot', entityId: id, before: { reviewStatus: 'PENDING' }, after: { reviewStatus: approve ? 'APPROVED' : 'REJECTED', reason: cleanReason || null } });
    if (notify) await notify(snap.campId, approve, cleanReason);
    return { id, reviewStatus: approve ? 'APPROVED' : 'REJECTED' };
  }
}
