import { Controller, Get, Header, Query } from '@nestjs/common';
import { Public } from '../common/decorators';
import { PublicService } from './public.service';

const CACHE = 'public, max-age=60, stale-while-revalidate=300';

/** قراءة فقط وبلا مصادقة (TC20) */
@Public()
@Controller('public')
export class PublicController {
  constructor(private svc: PublicService) {}

  @Get('stats') @Header('Cache-Control', CACHE) stats() { return this.svc.stats(); }
  @Get('map') @Header('Cache-Control', CACHE) map(@Query('month') month?: string) { return this.svc.map(month); }
  @Get('donation') @Header('Cache-Control', CACHE) donation() { return this.svc.donation(); }
  @Get('donors') @Header('Cache-Control', CACHE) donors() { return this.svc.donors(); }
}
