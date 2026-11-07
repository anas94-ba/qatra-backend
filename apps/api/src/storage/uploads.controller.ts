import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { memoryStorage } from 'multer';
import { Roles } from '../common/decorators';
import { detectFileType, MIME } from '../common/file-type';
import { StorageService } from './storage.service';

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

/** Delivery proof upload: jpg/png/webp/pdf only (no SVG) with a size limit, checked from content (TC65) */
@Roles(Role.ORG)
@ApiTags('Org - Uploads')
@ApiBearerAuth()
@Controller('org/uploads')
export class UploadsController {
  constructor(private storage: StorageService) {}

  @Post('proof')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_PROOF_BYTES, files: 1 } }))
  async proof(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('الملف مطلوب');
    const type = detectFileType(file.buffer);
    if (!type) throw new BadRequestException('نوع الملف غير مسموح (jpg/png/webp/pdf فقط)');
    const url = await this.storage.put(file.buffer, `proofs/${randomUUID()}.${type === 'jpeg' ? 'jpg' : type}`, MIME[type]);
    return { url };
  }
}
