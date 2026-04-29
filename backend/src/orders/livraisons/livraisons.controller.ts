import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';

import { LivraisonsService } from './livraisons.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('livraisons')
@UseGuards(JwtAuthGuard)
export class LivraisonsController {
  constructor(private service: LivraisonsService) {}

  @Get()
  findAll(@Query() filters: any) { return this.service.findAll(filters); }

  // ── Corbeille — AVANT :id ─────────────────────────────────────────────────

  @Get('corbeille')
  findCorbeille() { return this.service.findCorbeille(); }

  @Delete('corbeille/vider')
  viderCorbeille() { return this.service.viderCorbeille(); }

  @Delete('corbeille/:id')
  supprimerDefinitivement(@Param('id') id: string) { return this.service.supprimerDefinitivement(id); }

  // ── Routes par :id ────────────────────────────────────────────────────────

  @Get(':id')
  findById(@Param('id') id: string) { return this.service.findById(id); }

  @Post()
  create(@Body() body: any, @Request() req) {
    return this.service.create(body, req.user?.id);
  }

  @Patch(':id/statut')
  updateStatut(@Param('id') id: string, @Body() body: { statut: any; bonLivraisonUrl?: string; bonCommandeUrl?: string }) {
    return this.service.updateStatut(id, body.statut, body);
  }

  @Patch(':id/restaurer')
  restore(@Param('id') id: string) { return this.service.restore(id); }

  @Delete(':id')
  delete(@Param('id') id: string, @Request() req: any) {
    return this.service.delete(id, req.user?.id);
  }
}
