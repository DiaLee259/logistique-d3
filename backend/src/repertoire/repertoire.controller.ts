import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { RepertoireService } from './repertoire.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('repertoire')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RepertoireController {
  constructor(private service: RepertoireService) {}

  // ── Sociétés ─────────────────────────────────────────────────────────────────

  @Get('societes')
  listSocietes() {
    return this.service.listSocietes();
  }

  @Get('societes/actives')
  listSocietesActives() {
    return this.service.listSocietesActives();
  }

  @Post('societes')
  @Roles('ADMIN', 'LOGISTICIEN_1')
  createSociete(@Body() body: { nom: string; code?: string; adresse?: string; telephone?: string; email?: string }) {
    return this.service.createSociete(body);
  }

  @Put('societes/:id')
  @Roles('ADMIN', 'LOGISTICIEN_1')
  updateSociete(@Param('id') id: string, @Body() body: any) {
    return this.service.updateSociete(id, body);
  }

  @Delete('societes/:id')
  @Roles('ADMIN')
  deleteSociete(@Param('id') id: string) {
    return this.service.deleteSociete(id);
  }

  // ── Intervenants ──────────────────────────────────────────────────────────────

  @Get('intervenants')
  listIntervenants(@Query('societeId') societeId?: string) {
    return this.service.listIntervenants(societeId);
  }

  @Get('intervenants/actifs')
  listIntervenantsActifs() {
    return this.service.listIntervenantsActifs();
  }

  @Post('intervenants')
  @Roles('ADMIN', 'LOGISTICIEN_1')
  createIntervenant(@Body() body: { nom: string; prenom: string; email?: string; telephone?: string; societeId?: string }) {
    return this.service.createIntervenant(body);
  }

  @Put('intervenants/:id')
  @Roles('ADMIN', 'LOGISTICIEN_1')
  updateIntervenant(@Param('id') id: string, @Body() body: any) {
    return this.service.updateIntervenant(id, body);
  }

  @Delete('intervenants/:id')
  @Roles('ADMIN')
  deleteIntervenant(@Param('id') id: string) {
    return this.service.deleteIntervenant(id);
  }
}
