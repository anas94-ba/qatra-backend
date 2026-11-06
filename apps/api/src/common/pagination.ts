import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

/** ما يطلبه العميل */
export interface PageQuery {
  page: number;
  pageSize: number;
}

export interface PageMeta extends PageQuery {
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** شكل موحّد لكل القوائم */
export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

/** نافذة القراءة من قاعدة البيانات */
export interface PageWindow {
  skip: number;
  take: number;
}

/** يُورَّث في كل DTO لقائمة: ?page=1&pageSize=10 */
export class PaginationDto implements PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE;
}

export function buildMeta(total: number, { page, pageSize }: PageQuery): PageMeta {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return { total, page, pageSize, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}

export function toWindow({ page, pageSize }: PageQuery): PageWindow {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

/** قراءة الصفحة والعدد الكلي في معاملة واحدة */
export async function paginate<T>(
  prisma: PrismaService,
  query: PageQuery,
  find: (window: PageWindow) => Prisma.PrismaPromise<T[]>,
  count: () => Prisma.PrismaPromise<number>,
): Promise<Paginated<T>> {
  const [items, total] = await prisma.$transaction([find(toWindow(query)), count()]);
  return { items, meta: buildMeta(total, query) };
}

export function mapPage<T, R>(page: Paginated<T>, fn: (item: T) => R): Paginated<R> {
  return { items: page.items.map(fn), meta: page.meta };
}
