import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, Res, UseGuards } from '@nestjs/common';

import { CommandesService } from './commandes.service';
import { CreateCommandeDto } from './dto/create-commande.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Public } from '../../auth/public.decorator';

@Controller('commandes')
export class CommandesController {
  constructor(private service: CommandesService) {}

  // ── Routes publiques prestataire ──────────────────────────────────────────

  @Public()
  @Get('public/suivi/:numero')
  getSuiviPublic(@Param('numero') numero: string) {
    return this.service.getSuiviPublic(numero);
  }

  @Public()
  @Get('public/:token')
  getLienPublic(@Param('token') token: string) {
    return this.service.getLienPublic(token);
  }

  @Public()
  @Post('public/:token')
  createPublique(@Param('token') token: string, @Body() body: any) {
    return this.service.createPublique(token, body);
  }

  // ── Routes protégées ──────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query() filters: any) {
    return this.service.findAll(filters);
  }

  @UseGuards(JwtAuthGuard)
  @Get('liens')
  listLiens() {
    return this.service.listLiensPrestataire();
  }

  @UseGuards(JwtAuthGuard)
  @Post('liens')
  genererLien(@Body() body: { nom: string; expiresInDays?: number }, @Request() req: any) {
    return this.service.genererLienPrestataire(body.nom, req.user.id, body.expiresInDays);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('liens/:id/desactiver')
  desactiverLien(@Param('id') id: string) {
    return this.service.desactiverLien(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateCommandeDto) {
    return this.service.create(dto);
  }

  // Log1 ET Log2 peuvent valider (traiter dès la réception)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LOGISTICIEN_1', 'LOGISTICIEN_2')
  @Patch(':id/valider')
  valider(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.service.valider(id, body, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/fiche-perception')
  async getFichePerception(@Param('id') id: string, @Res() res: any) {
    const pdfBuffer = await this.service.genererFichePerception(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="fiche-perception-${id}.pdf"`);
    res.send(pdfBuffer);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/email-envoye')
  marquerEmailEnvoye(@Param('id') id: string) {
    return this.service.marquerEmailEnvoye(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/bon-retour')
  marquerBonRetourRecu(@Param('id') id: string, @Body() body: { url?: string }) {
    return this.service.marquerBonRetourRecu(id, body.url);
  }

  // Log1 ET Log2 peuvent expédier
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LOGISTICIEN_1', 'LOGISTICIEN_2')
  @Patch(':id/expedier')
  expedier(@Param('id') id: string, @Body() body: { commentaire?: string }, @Request() req: any) {
    return this.service.expedier(id, req.user.id, body.commentaire);
  }

  // Tout le monde peut marquer livrée
  @UseGuards(JwtAuthGuard)
  @Patch(':id/livree')
  marquerLivree(@Param('id') id: string) {
    return this.service.marquerLivree(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/annuler')
  annuler(@Param('id') id: string) {
    return this.service.annuler(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('corbeille')
  findCorbeille() { return this.service.findCorbeille(); }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/restaurer')
  restore(@Param('id') id: string) { return this.service.restore(id); }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LOGISTICIEN_1', 'LOGISTICIEN_2')
  @Delete(':id')
  delete(@Param('id') id: string, @Request() req: any) {
    return this.service.delete(id, req.user?.id);
  }
}
