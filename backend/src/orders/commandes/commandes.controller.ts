import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, Res, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';

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

  // ── Routes statiques (AVANT :id pour éviter conflit de routes) ───────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LOGISTICIEN_1')
  @Get('template')
  async templateCommandes(@Res() res: Response) {
    const wb = new ExcelJS.Workbook();
    // Onglet d'aide
    const help = wb.addWorksheet('📋 Instructions');
    help.getCell('A1').value = '1 fichier = 1 commande. Les colonnes A–F (info commande) sont lues sur la 1ère ligne de données uniquement.';
    help.getCell('A2').value = 'Chaque ligne suivante ajoute un article à cette commande (colonnes G, I). La colonne H (Désignation) est informative — ignorée à l\'import.';
    help.getCell('A1').font = { bold: true };
    help.getCell('A1').alignment = { wrapText: true };
    help.getColumn('A').width = 100;

    const ws = wb.addWorksheet('Commande');
    ws.columns = [
      { header: 'Demandeur *', key: 'demandeur', width: 25 },       // A
      { header: 'Département *', key: 'departement', width: 20 },   // B
      { header: 'Société', key: 'societe', width: 25 },             // C
      { header: 'Manager', key: 'manager', width: 25 },             // D
      { header: 'Email demandeur', key: 'email', width: 30 },       // E
      { header: 'Téléphone destinataire', key: 'telephone', width: 20 }, // F
      { header: 'Adresse de livraison', key: 'adresse', width: 40 },    // G
      { header: 'Commentaire commande', key: 'commentaire', width: 35 }, // H
      { header: 'Référence article *', key: 'refArticle', width: 20 },  // I
      { header: 'Désignation (info)', key: 'designation', width: 35 },  // J
      { header: 'Quantité demandée *', key: 'quantite', width: 16 },    // K
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6E' } };
    ws.addRow({ demandeur: 'Jean Dupont', departement: 'TRAVAUX', societe: 'TechFibre SARL', manager: 'Marie Martin', email: 'j.dupont@tech.fr', telephone: '06 12 34 56 78', adresse: '12 rue de la Paix, Lyon', commentaire: '', refArticle: 'CAB-FO-G657', designation: 'Câble FO G657', quantite: 100 });
    ws.addRow({ demandeur: '', departement: '', societe: '', manager: '', email: '', telephone: '', adresse: '', commentaire: '', refArticle: 'CON-SC-APC', designation: 'Connecteur SC/APC', quantite: 20 });
    ws.addRow({ demandeur: '', departement: '', societe: '', manager: '', email: '', telephone: '', adresse: '', commentaire: '', refArticle: 'MUF-SC', designation: 'Manchon de protection', quantite: 5 });
    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-commandes.xlsx"');
    res.send(buffer);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LOGISTICIEN_1')
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importCommandes(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    return this.service.importCommandes(file.buffer, req.user?.id);
  }

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

  // ── Corbeille — toutes ces routes AVANT @Get(':id') ──────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('corbeille')
  findCorbeille() { return this.service.findCorbeille(); }

  @UseGuards(JwtAuthGuard)
  @Delete('corbeille/vider')
  viderCorbeille() { return this.service.viderCorbeille(); }

  @UseGuards(JwtAuthGuard)
  @Delete('corbeille/:id')
  supprimerDefinitivement(@Param('id') id: string) { return this.service.supprimerDefinitivement(id); }

  // ── Routes par :id ────────────────────────────────────────────────────────

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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LOGISTICIEN_1', 'LOGISTICIEN_2')
  @Patch(':id/modifier')
  updateDetails(@Param('id') id: string, @Body() body: any) {
    return this.service.updateDetails(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LOGISTICIEN_1', 'LOGISTICIEN_2')
  @Patch(':id/expedier')
  expedier(@Param('id') id: string, @Body() body: { commentaire?: string; lignes?: { ligneId: string; quantite: number }[] }, @Request() req: any) {
    return this.service.expedier(id, req.user.id, body);
  }

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
  @Patch(':id/restaurer')
  restore(@Param('id') id: string) { return this.service.restore(id); }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LOGISTICIEN_1', 'LOGISTICIEN_2')
  @Delete(':id')
  delete(@Param('id') id: string, @Request() req: any) {
    return this.service.delete(id, req.user?.id);
  }
}
