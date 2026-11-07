import { buildMeta, DEFAULT_PAGE_SIZE, mapPage, toWindow } from './pagination';

describe('pagination', () => {
  it('defaults to 10 items per page', () => expect(DEFAULT_PAGE_SIZE).toBe(10));

  it('read window', () => expect(toWindow({ page: 3, pageSize: 10 })).toEqual({ skip: 20, take: 10 }));

  it('page metadata', () => {
    expect(buildMeta(25, { page: 1, pageSize: 10 })).toEqual({ total: 25, page: 1, pageSize: 10, totalPages: 3, hasNext: true, hasPrev: false });
    expect(buildMeta(25, { page: 3, pageSize: 10 })).toMatchObject({ hasNext: false, hasPrev: true });
  });

  it('empty list: a single page', () => expect(buildMeta(0, { page: 1, pageSize: 10 })).toMatchObject({ totalPages: 1, hasNext: false }));

  it('mapPage maps items and keeps meta', () => {
    const meta = buildMeta(2, { page: 1, pageSize: 10 });
    expect(mapPage({ items: [1, 2], meta }, (x) => x * 2)).toEqual({ items: [2, 4], meta });
  });
});
