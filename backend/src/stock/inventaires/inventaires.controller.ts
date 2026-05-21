import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { InventairesService } from './inventaires.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';

@Controller('inventaires')
@UseGuards(JwtAuthGuard)
export class InventairesController {
  constructor(private service: InventairesService) {}

  @Get('template')
  async templateInventaire(@Res() res: Response) {
    const articles = await this.service.getAllArticlesForTemplate();

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Inventaire');
    ws.columns = [
      { header: 'Code entrepôt *', key: 'codeEntrepot', width: 15 },
      { header: 'Référence article *', key: 'refArticle', width: 25 },
      { header: 'Nom article', key: 'nomArticle', width: 45 },
      { header: 'Quantité comptée *', key: 'quantite', width: 18 },
      { header: 'Commentaire', key: 'commentaire', width: 35 },
    ];
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6E' } };

    for (const article of articles) {
      const row = ws.addRow({
        codeEntrepot: '',
        refArticle: article.reference,
        nomArticle: article.nom,
        quantite: null,
        commentaire: '',
      });
      if (!article.actif) {
        row.getCell('refArticle').font = { color: { argb: 'FF999999' }, italic: true };
        row.getCell('nomArticle').font = { color: { argb: 'FF999999' }, italic: true };
      }
    }

    const help = wb.addWorksheet('📋 Instructions');
    help.getCell('A1').value = 'Remplissez la colonne "Code entrepôt *" avec le code de votre entrepôt (ex: ENT01) et la colonne "Quantité comptée *" pour chaque article.';
    help.getCell('A2').value = 'Les articles en gris/italique sont inactifs — vous pouvez les ignorer ou les inclure si besoin.';
    help.getCell('A3').value = 'La colonne "Nom article" est informative — elle est ignorée à l\'import.';
    help.getCell('A1').font = { bold: true };
    ['A1', 'A2', 'A3'].forEach(c => { help.getCell(c).alignment = { wrapText: true }; });
    help.getColumn('A').width = 120;

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-inventaire.xlsx"');
    res.send(buffer);
  }

  // ── Corbeille (statiques avant /:id) ──────────────────────────────────────

  @Get('corbeille')
  findCorbeille() { return this.service.findCorbeille(); }

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CHEF_PROJET')
  @Delete('corbeille/vider')
  viderCorbeille() { return this.service.viderCorbeille(); }

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CHEF_PROJET')
  @Delete('corbeille/:id')
  supprimerDefinitivement(@Param('id') id: string) { return this.service.supprimerDefinitivement(id); }

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CHEF_PROJET')
  @Patch('corbeille/:id/restaurer')
  restaurer(@Param('id') id: string) { return this.service.restore(id); }

  // ── Import / template ────────────────────────────────────────────────────

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importInventaire(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    return this.service.importInventaire(file.buffer, req.user?.id);
  }

  // ── Listes / états ────────────────────────────────────────────────────────

  @Get()
  findAll(@Query() filters: any, @Request() req: any) {
    const userEntrepots: string[] = req.user?.privileges?.entrepots ?? [];
    return this.service.findAll({ ...filters, userEntrepots });
  }

  @Get('alertes')
  getAlertes(@Request() req: any) {
    const userEntrepots: string[] = req.user?.privileges?.entrepots ?? [];
    return this.service.getAlertes(userEntrepots);
  }

  @Get('entrepot')
  getEtat(@Query('entrepotId') entrepotId: string) {
    return this.service.getEtatParEntrepot(entrepotId);
  }

  // ── Création ─────────────────────────────────────────────────────────────

  @Post()
  create(@Body() body: any, @Request() req: any) {
    return this.service.create(body, req.user?.id);
  }

  /** Mise à jour d'un seul article (sans toucher les autres) */
  @Post('update-article')
  updateArticle(@Body() body: any, @Request() req: any) {
    return this.service.updateArticle(body, req.user?.id);
  }

  // ── Suppression (bulk avant :id) ──────────────────────────────────────────

  @Delete('bulk')
  deleteBulk(@Body() body: { ids: string[] }, @Request() req: any) {
    return this.service.deleteBulk(body.ids, req.user?.id);
  }

  @Delete(':id')
  deleteOne(@Param('id') id: string, @Request() req: any) {
    return this.service.deleteOne(id, req.user?.id);
  }
}
