import { Controller, Get, Post, Delete, Body, Param, Query, Request, UseGuards, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { InventairesService } from './inventaires.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('inventaires')
@UseGuards(JwtAuthGuard)
export class InventairesController {
  constructor(private service: InventairesService) {}

  @Get('template')
  async templateInventaire(@Res() res: Response) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Inventaire');
    ws.columns = [
      { header: 'Code entrepôt *', key: 'codeEntrepot', width: 15 },
      { header: 'Référence article *', key: 'refArticle', width: 20 },
      { header: 'Nom article', key: 'nomArticle', width: 35 },
      { header: 'Quantité comptée *', key: 'quantite', width: 16 },
      { header: 'Commentaire', key: 'commentaire', width: 35 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6E' } };
    ws.addRow({ codeEntrepot: 'ENT01', refArticle: 'CAB-FO-G657', nomArticle: 'Câble FO G657', quantite: 150, commentaire: '' });
    ws.addRow({ codeEntrepot: 'ENT01', refArticle: 'CON-SC-APC', nomArticle: 'Connecteur SC/APC', quantite: 85, commentaire: 'Recounted' });
    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-inventaire.xlsx"');
    res.send(buffer);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importInventaire(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    return this.service.importInventaire(file.buffer, req.user?.id);
  }

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

  // Suppression d'une liste d'IDs (session entière)
  @Delete('bulk')
  deleteBulk(@Body() body: { ids: string[] }) {
    return this.service.deleteBulk(body.ids);
  }

  // Suppression d'un seul enregistrement
  @Delete(':id')
  deleteOne(@Param('id') id: string) {
    return this.service.deleteOne(id);
  }
}
