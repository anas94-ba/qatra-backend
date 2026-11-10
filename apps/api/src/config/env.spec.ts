import { parseDuration } from './env';

describe('parseDuration', () => {
  it('parses units and bare seconds', () => {
    expect(parseDuration('900')).toBe(900);
    expect(parseDuration('15m')).toBe(900);
    expect(parseDuration('2h')).toBe(7200);
    expect(parseDuration('1d')).toBe(86_400);
  });
  it('rejects invalid values', () => {
    expect(() => parseDuration('soon')).toThrow();
    expect(() => parseDuration('-5m')).toThrow();
  });
});
