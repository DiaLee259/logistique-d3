import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, Request, UseGuards, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { MouvementsService } from './mouvements.service';
import { CreateMouvementDto } from './dto/create-mouvement.dto';
import { FilterMouvementsDto } from './dto/filter-mouvements.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import * as ExcelJS from 'exceljs';

@Controller('mouvements')
@UseGuards(JwtAuthGuard)
export class MouvementsController {
  constructor(private service: MouvementsService) {}

  @Get('template')
  async templateMouvements(@Res() res: Response) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Mouvements');
    ws.columns = [
      { header: 'Type (ENTREE/SORTIE) *', key: 'type', width: 18 },
      { header: 'Date (YYYY-MM-DD) *', key: 'date', width: 15 },
      { header: 'Référence article *', key: 'refArticle', width: 20 },
      { header: 'Code entrepôt *', key: 'codeEntrepot', width: 15 },
      { header: 'Quantité fournie *', key: 'qteFournie', width: 16 },
      { header: 'Quantité demandée', key: 'qteDemandee', width: 16 },
      { header: 'Département', key: 'departement', width: 20 },
      { header: 'Manager/Demandeur', key: 'manager', width: 25 },
      { header: 'N° commande', key: 'numeroCommande', width: 18 },
      { header: 'Source/Destination', key: 'sourceDestination', width: 25 },
      { header: 'Commentaire', key: 'commentaire', width: 35 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6E' } };
    ws.addRow({ type: 'SORTIE', date: '2026-04-30', refArticle: 'CAB-FO-G657', codeEntrepot: 'ENT01', qteFournie: 50, qteDemandee: 50, departement: 'TRAVAUX', manager: 'Jean Dupont', numeroCommande: 'CMD-2026-0001', sourceDestination: 'Chantier Lyon', commentaire: '' });
    ws.addRow({ type: 'ENTREE', date: '2026-04-30', refArticle: 'CON-SC-APC', codeEntrepot: 'ENT01', qteFournie: 200, qteDemandee: 200, departement: '', manager: '', numeroCommande: '', sourceDestination: 'Fournisseur', commentaire: '' });
    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-mouvements.xlsx"');
    res.send(buffer);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importMouvements(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    return this.service.importMouvements(file.buffer, req.user?.id);
  }

  @Get()
  findAll(@Query() filters: FilterMouvementsDto, @Request() req: any) {
    const userEntrepots: string[] = req.user?.privileges?.entrepots ?? [];
    return this.service.findAll({ ...filters, userEntrepots } as any);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  create(@Body() dto: CreateMouvementDto, @Request() req) {
    return this.service.create(dto, req.user?.id);
  }

  @Post('batch')
  createMultiple(@Body() body: { items: CreateMouvementDto[] }, @Request() req) {
    return this.service.createMultiple(body.items, req.user?.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateMouvementDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Patch(':id/toggle/:field')
  toggleField(@Param('id') id: string, @Param('field') field: 'envoye' | 'recu') {
    return this.service.toggleField(id, field);
  }
}
