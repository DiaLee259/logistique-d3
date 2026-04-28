import { Controller, Get, Post, Body, Query, Request, UseGuards } from '@nestjs/common';
import { InventairesService } from './inventaires.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('inventaires')
@UseGuards(JwtAuthGuard)
export class InventairesController {
  constructor(private service: InventairesService) {}

  @Get()
  findAll(@Query() filters: any) { return this.service.findAll(filters); }

  @Get('alertes')
  getAlertes() { return this.service.getAlertes(); }

  @Get('entrepot')
  getEtat(@Query('entrepotId') entrepotId: string) {
    return this.service.getEtatParEntrepot(entrepotId);
  }

  @Post()
  create(@Body() body: any, @Request() req: any) {
    return this.service.create(body, req.user?.userId);
  }
}
