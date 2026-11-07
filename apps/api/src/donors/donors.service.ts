import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { AuditService } from '../audit/audit.service';
import { detectFileType } from '../common/file-type';
import { PaginationDto, paginate } from '../common/pagination';
import { escapeHtml, sanitizeText } from '../common/text';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateDonorDto, UpdateDonorDto } from './dto';

@Injectable()
export class DonorsService {
  constructor(private prisma: PrismaService, private audit: AuditService, private storage: StorageService) {}

  list(q: PaginationDto) {
    return paginate(
      this.prisma,
      q,
      (window) => this.prisma.donor.findMany({ orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }], ...window }),
      () => this.prisma.donor.count(),
    );
  }

  /** WebP/JPG/PNG only (no SVG), converted to WebP at a uniform size; consent, its date and alt text are mandatory (TC78, TC81) */
  async create(adminId: string, file: Express.Multer.File | undefined, dto: CreateDonorDto) {
    if (!file) throw new BadRequestException('صورة المانح مطلوبة');
    const type = detectFileType(file.buffer);
    if (!type || type === 'pdf') throw new BadRequestException('نوع الصورة غير مسموح (WebP/JPG/PNG فقط)');
    const buf = await sharp(file.buffer).rotate().resize(400, 400, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();
    const imageUrl = await this.storage.put(buf, `donors/${randomUUID()}.webp`, 'image/webp');
    const donor = await this.prisma.donor.create({
      data: {
        imageUrl, altText: escapeHtml(sanitizeText(dto.altText)), consentGivenAt: new Date(dto.consentGivenAt), consentSource: sanitizeText(dto.consentSource),
        displayOrder: dto.displayOrder ?? 0, isPublished: dto.isPublished ?? false,
      },
    });
    await this.audit.log({ userId: adminId, action: 'CREATE', entity: 'Donor', entityId: donor.id, after: donor });
    return donor;
  }

  async update(adminId: string, id: string, dto: UpdateDonorDto) {
    const before = await this.prisma.donor.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('المانح غير موجود');
    const after = await this.prisma.donor.update({
      where: { id },
      data: { altText: dto.altText ? escapeHtml(sanitizeText(dto.altText)) : undefined, displayOrder: dto.displayOrder, isPublished: dto.isPublished },
    });
    await this.audit.log({ userId: adminId, action: 'UPDATE', entity: 'Donor', entityId: id, before, after });
    return after;
  }

  async remove(adminId: string, id: string) {
    const before = await this.prisma.donor.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('المانح غير موجود');
    await this.prisma.donor.delete({ where: { id } });
    await this.audit.log({ userId: adminId, action: 'DELETE', entity: 'Donor', entityId: id, before });
    return { ok: true };
  }
}
