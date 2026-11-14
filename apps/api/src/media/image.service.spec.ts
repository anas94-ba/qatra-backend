import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { IMAGE_PRESETS, ImageService } from './image.service';

const service = new ImageService();
const solid = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: '#2a82cf' } });
const isWebp = (b: Buffer) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP';

describe('ImageService.toWebp', () => {
  it('converts a PNG to WebP and caps the longest side (proof preset)', async () => {
    const out = await service.toWebp(await solid(3000, 2000).png().toBuffer(), IMAGE_PRESETS.proof);
    expect(isWebp(out.buffer)).toBe(true);
    expect(Math.max(out.width, out.height)).toBe(1600);
    expect(out.width / out.height).toBeCloseTo(1.5, 1);
  });

  it('never enlarges small images', async () => {
    const out = await service.toWebp(await solid(300, 200).jpeg().toBuffer(), IMAGE_PRESETS.proof);
    expect([out.width, out.height]).toEqual([300, 200]);
  });

  it('crops donor logos to an exact square', async () => {
    const out = await service.toWebp(await solid(900, 500).png().toBuffer(), IMAGE_PRESETS.donor);
    expect([out.width, out.height]).toEqual([400, 400]);
  });

  it('removes EXIF metadata such as GPS and copyright', async () => {
    const withExif = await solid(200, 200).jpeg().withExif({ IFD0: { Copyright: 'secret-camera-owner' } }).toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const out = await service.toWebp(withExif, IMAGE_PRESETS.proof);
    expect((await sharp(out.buffer).metadata()).exif).toBeUndefined();
  });

  it('rejects corrupt input', async () => {
    await expect(service.toWebp(Buffer.from('not an image at all'), IMAGE_PRESETS.proof)).rejects.toBeInstanceOf(BadRequestException);
  });
});
