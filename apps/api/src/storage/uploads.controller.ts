import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { memoryStorage } from 'multer';
import { Roles } from '../common/decorators';
import { detectFileType, MIME } from '../common/file-type';
import { StorageService } from './storage.service';

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

/** رفع إثبات تسليم: jpg/png/webp/pdf فقط (لا SVG) وبحجم محدود، والفحص من المحتوى (TC65) */
@Roles(Role.ORG)
@Controller('org/uploads')
export class UploadsController {
  constructor(private storage: StorageService) {}

  @Post('proof')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_PROOF_BYTES, files: 1 } }))
  async proof(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('الملف مطلوب');
    const type = detectFileType(file.buffer);
    if (!type) throw new BadRequestException('نوع الملف غير مسموح (jpg/png/webp/pdf فقط)');
    const url = await this.storage.put(file.buffer, `proofs/${randomUUID()}.${type === 'jpeg' ? 'jpg' : type}`, MIME[type]);
    return { url };
  }
}
