import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { CommandesTSService } from './commandes-ts.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('commandes-ts')
@UseGuards(JwtAuthGuard)
export class CommandesTSController {
  constructor(private service: CommandesTSService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  // ── Corbeille — AVANT :id ─────────────────────────────────────────────────

  @Get('corbeille')
  findCorbeille() { return this.service.findCorbeille(); }

  @Delete('corbeille/vider')
  viderCorbeille() { return this.service.viderCorbeille(); }

  @Delete('corbeille/:id')
  supprimerDefinitivement(@Param('id') id: string) { return this.service.supprimerDefinitivement(id); }

  // ── Sous-ressources (2 segments — pas de conflit avec :id) ───────────────

  @Put('lignes/:ligneId')
  updateLigne(@Param('ligneId') ligneId: string, @Body() dto: any) {
    return this.service.updateLigne(ligneId, dto);
  }

  @Put('repartitions/:repartitionId')
  updateRepartition(@Param('repartitionId') repartitionId: string, @Body() dto: any) {
    return this.service.updateRepartition(repartitionId, dto);
  }

  // ── Routes par :id ────────────────────────────────────────────────────────

  @Get(':id')
  findById(@Param('id') id: string) { return this.service.findById(id); }

  @Post()
  create(@Body() dto: any, @Request() req: any) {
    return this.service.create(dto, req.user.userId ?? req.user.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Put(':id/cloturer')
  cloturer(@Param('id') id: string) { return this.service.cloturer(id); }

  @Patch(':id/restaurer')
  restore(@Param('id') id: string) { return this.service.restore(id); }

  @Delete(':id')
  delete(@Param('id') id: string, @Request() req: any) {
    return this.service.delete(id, req.user?.id);
  }
}
