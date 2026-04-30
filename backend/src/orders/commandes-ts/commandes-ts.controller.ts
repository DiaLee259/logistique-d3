import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, Request, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { CommandesTSService } from './commandes-ts.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('commandes-ts')
@UseGuards(JwtAuthGuard)
export class CommandesTSController {
  constructor(private service: CommandesTSService) {}

  @Get('template')
  async templateCommandesTS(@Res() res: Response) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('CommandesTS');
    ws.columns = [
      { header: 'Ref groupe *', key: 'refGroupe', width: 15 },
      { header: 'Titre *', key: 'titre', width: 35 },
      { header: 'Date début (YYYY-MM-DD) *', key: 'dateDebut', width: 18 },
      { header: 'Date fin (YYYY-MM-DD) *', key: 'dateFin', width: 18 },
      { header: 'Commentaire', key: 'commentaire', width: 35 },
      { header: 'Référence article *', key: 'refArticle', width: 20 },
      { header: 'Qté PROD', key: 'qteProd', width: 12 },
      { header: 'Qté SAV', key: 'qteSav', width: 12 },
      { header: 'Qté Malfaçon', key: 'qteMalfacon', width: 14 },
      { header: 'Code entrepôt', key: 'codeEntrepot', width: 15 },
      { header: 'Taux répartition (%)', key: 'tauxRepartition', width: 18 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6E' } };
    ws.addRow({ refGroupe: 'G1', titre: 'Déploiement Fibre Q1', dateDebut: '2026-04-01', dateFin: '2026-06-30', commentaire: '', refArticle: 'CAB-FO-G657', qteProd: 500, qteSav: 50, qteMalfacon: 10, codeEntrepot: 'ENT01', tauxRepartition: 60 });
    ws.addRow({ refGroupe: 'G1', titre: 'Déploiement Fibre Q1', dateDebut: '2026-04-01', dateFin: '2026-06-30', commentaire: '', refArticle: 'CAB-FO-G657', qteProd: 500, qteSav: 50, qteMalfacon: 10, codeEntrepot: 'ENT02', tauxRepartition: 40 });
    ws.addRow({ refGroupe: 'G1', titre: 'Déploiement Fibre Q1', dateDebut: '2026-04-01', dateFin: '2026-06-30', commentaire: '', refArticle: 'CON-SC-APC', qteProd: 200, qteSav: 20, qteMalfacon: 5, codeEntrepot: 'ENT01', tauxRepartition: 100 });
    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-commandes-ts.xlsx"');
    res.send(buffer);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importCommandesTS(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    return this.service.importCommandesTS(file.buffer, req.user?.id);
  }

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
