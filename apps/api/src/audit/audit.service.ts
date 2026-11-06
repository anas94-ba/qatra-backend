import { Injectable } from '@nestjs/common';
import { AuditLog, Prisma } from '@prisma/client';
import { Paginated, paginate } from '../common/pagination';
import { Db, PrismaService } from '../prisma/prisma.service';
import { AuditQueryDto } from './dto';

export interface AuditEntry {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

const SECRET_KEYS = new Set(['passwordHash', 'tokenHash', 'password', 'refreshToken']);

/** نسخة JSON آمنة بلا أسرار، وتحوّل Date إلى نص */
function scrub(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === undefined || v === null) return undefined;
  return JSON.parse(JSON.stringify(v, (k, val) => (SECRET_KEYS.has(k) ? undefined : val)));
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /** يُمرَّر `tx` لتُسجَّل العملية الحساسة في نفس المعاملة */
  log(entry: AuditEntry, db: Db = this.prisma) {
    return db.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        before: scrub(entry.before),
        after: scrub(entry.after),
      },
    });
  }

  list(q: AuditQueryDto): Promise<Paginated<AuditLog>> {
    const where: Prisma.AuditLogWhereInput = {
      entity: q.entity || undefined,
      entityId: q.entityId || undefined,
      userId: q.userId || undefined,
      action: q.action || undefined,
      createdAt: { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined },
    };
    return paginate(
      this.prisma,
      q,
      (window) => this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...window }),
      () => this.prisma.auditLog.count({ where }),
    );
  }
}
