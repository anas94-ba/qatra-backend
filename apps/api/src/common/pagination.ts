import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { PageQuery } from './pagination.dto';

export { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, PaginationDto } from './pagination.dto';
export type { PageQuery } from './pagination.dto';

export interface PageMeta extends PageQuery {
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** Uniform shape for every list */
export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

/** Database read window */
export interface PageWindow {
  skip: number;
  take: number;
}

export function buildMeta(total: number, { page, pageSize }: PageQuery): PageMeta {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return { total, page, pageSize, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}

export function toWindow({ page, pageSize }: PageQuery): PageWindow {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

/** Reads the page and the total count in a single transaction */
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
