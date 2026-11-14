import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';

export interface WebpPreset {
  /** Bounding box (or exact size for fit "cover") in pixels */
  width: number;
  height: number;
  fit: 'inside' | 'cover';
  /** WebP quality, 1-100 */
  quality: number;
}

/** Where each kind of upload ends up: small, web-ready WebP files */
export const IMAGE_PRESETS = {
  /** Delivery proofs: keep the photo readable, cap the longest side */
  proof: { width: 1600, height: 1600, fit: 'inside', quality: 80 },
  /** Donor logos: uniform square thumbnails */
  donor: { width: 400, height: 400, fit: 'cover', quality: 82 },
} as const satisfies Record<string, WebpPreset>;

export interface ConvertedImage {
  buffer: Buffer;
  width: number;
  height: number;
}

/** Hard cap on decoded pixels (about 40 MP) so a tiny file cannot expand into gigabytes of memory */
const MAX_INPUT_PIXELS = 40_000_000;

/**
 * Converts any supported raster image (JPEG, PNG, WebP, ...) to WebP with sharp:
 *  - EXIF orientation is applied, then ALL metadata (GPS position, camera, dates) is dropped
 *  - never enlarges, resizes to the preset
 *  - rejects corrupt files and decompression bombs
 */
@Injectable()
export class ImageService {
  async toWebp(input: Buffer, preset: WebpPreset): Promise<ConvertedImage> {
    try {
      const { data, info } = await sharp(input, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize({ width: preset.width, height: preset.height, fit: preset.fit, withoutEnlargement: preset.fit === 'inside' })
        .webp({ quality: preset.quality, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      return { buffer: data, width: info.width, height: info.height };
    } catch {
      throw new BadRequestException('الصورة تالفة أو غير مدعومة');
    }
  }
}
