import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { memoryStorage } from 'multer';
import { CurrentUser, Roles } from '../common/decorators';
import { PaginationDto } from '../common/pagination';
import { AuthUser } from '../common/types';
import { CreateDonorDto, UpdateDonorDto } from './dto';
import { DonorsService } from './donors.service';

@Roles(Role.ADMIN)
@ApiTags('Admin - Donors')
@ApiBearerAuth()
@Controller('admin/donors')
export class DonorsController {
  constructor(private svc: DonorsService) {}

  @Get() list(@Query() query: PaginationDto) { return this.svc.list(query); }

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image', 'altText', 'consentGivenAt', 'consentSource'],
      properties: {
        image: { type: 'string', format: 'binary' },
        altText: { type: 'string' },
        consentGivenAt: { type: 'string', format: 'date-time' },
        consentSource: { type: 'string' },
        displayOrder: { type: 'integer' },
        isPublished: { type: 'boolean' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } }))
  create(@CurrentUser() u: AuthUser, @UploadedFile() file: Express.Multer.File, @Body() dto: CreateDonorDto) { return this.svc.create(u.id, file, dto); }

  @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateDonorDto) { return this.svc.update(u.id, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.remove(u.id, id); }
}
