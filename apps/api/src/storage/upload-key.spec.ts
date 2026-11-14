import { uploadKey } from './upload-key';

describe('uploadKey', () => {
  it('puts proofs in dated folders', () => {
    expect(uploadKey('proofs', 'webp', new Date('2026-11-14T10:00:00Z'))).toMatch(/^proofs\/2026\/11\/[0-9a-f-]{36}\.webp$/);
  });
  it('keeps donors flat', () => {
    expect(uploadKey('donors', 'webp')).toMatch(/^donors\/[0-9a-f-]{36}\.webp$/);
  });
  it('never repeats a name', () => {
    expect(uploadKey('donors', 'webp')).not.toBe(uploadKey('donors', 'webp'));
  });
});
