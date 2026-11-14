import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { memoryStorage } from 'multer';
import { Roles } from '../common/decorators';
import { detectFileType, MIME } from '../common/file-type';
import { IMAGE_PRESETS, ImageService } from '../media/image.service';
import { StorageService } from './storage.service';
import { uploadKey } from './upload-key';

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

/** Delivery proof upload: jpg/png/webp/pdf only (no SVG), size-limited and checked from content (TC65). Images are stored as WebP. */
@Roles(Role.ORG)
@ApiTags('Org - Uploads')
@ApiBearerAuth()
@Controller('org/uploads')
export class UploadsController {
  constructor(private storage: StorageService, private images: ImageService) {}

  @Post('proof')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_PROOF_BYTES, files: 1 } }))
  async proof(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('الملف مطلوب');
    const type = detectFileType(file.buffer);
    if (!type) throw new BadRequestException('نوع الملف غير مسموح (jpg/png/webp/pdf فقط)');
    // PDFs are stored as they are; every image is re-encoded to a metadata-free WebP
    if (type === 'pdf') return { url: await this.storage.put(file.buffer, uploadKey('proofs', 'pdf'), MIME.pdf) };
    const { buffer } = await this.images.toWebp(file.buffer, IMAGE_PRESETS.proof);
    return { url: await this.storage.put(buffer, uploadKey('proofs', 'webp'), 'image/webp') };
  }
}
