import { Body, Controller, Delete, Get, Param, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { memoryStorage } from 'multer';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { CreateDonorDto, UpdateDonorDto } from './dto';
import { DonorsService } from './donors.service';

@Roles(Role.ADMIN)
@Controller('admin/donors')
export class DonorsController {
  constructor(private svc: DonorsService) {}

  @Get() list() { return this.svc.list(); }

  @Post()
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } }))
  create(@CurrentUser() u: AuthUser, @UploadedFile() file: Express.Multer.File, @Body() dto: CreateDonorDto) { return this.svc.create(u.id, file, dto); }

  @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateDonorDto) { return this.svc.update(u.id, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.remove(u.id, id); }
}
