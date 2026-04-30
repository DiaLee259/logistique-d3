import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';

import { LivraisonsService } from './livraisons.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('livraisons')
@UseGuards(JwtAuthGuard)
export class LivraisonsController {
  constructor(private service: LivraisonsService) {}

  @Get('template')
  async templateLivraisons(@Res() res: Response) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Livraisons');
    ws.columns = [
      { header: 'Ref groupe', key: 'refGroupe', width: 15 },
      { header: 'N° commande liée', key: 'numeroCommande', width: 20 },
      { header: 'Code entrepôt *', key: 'codeEntrepot', width: 15 },
      { header: 'Transporteur', key: 'transporteur', width: 25 },
      { header: 'N° suivi', key: 'numeroSuivi', width: 20 },
      { header: 'Date livraison prévue (YYYY-MM-DD)', key: 'datePrevue', width: 25 },
      { header: 'Référence article *', key: 'refArticle', width: 20 },
      { header: 'Quantité reçue *', key: 'quantiteRecue', width: 15 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6E' } };
    ws.addRow({ refGroupe: 'L1', numeroCommande: 'CMD-2026-0001', codeEntrepot: 'ENT01', transporteur: 'Chronopost', numeroSuivi: '1Z999AA10123456784', datePrevue: '2026-05-15', refArticle: 'CAB-FO-G657', quantiteRecue: 100 });
    ws.addRow({ refGroupe: 'L1', numeroCommande: 'CMD-2026-0001', codeEntrepot: 'ENT01', transporteur: '', numeroSuivi: '', datePrevue: '', refArticle: 'CON-SC-APC', quantiteRecue: 20 });
    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-livraisons.xlsx"');
    res.send(buffer);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importLivraisons(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    return this.service.importLivraisons(file.buffer, req.user?.id);
  }

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
