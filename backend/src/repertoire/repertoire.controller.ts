import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, Res, StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { RepertoireService } from './repertoire.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import * as ExcelJS from 'exceljs';

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

  @Get('societes/template')
  @Roles('ADMIN', 'LOGISTICIEN_1')
  async templateSocietes(@Res() res: Response) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sociétés');
    ws.columns = [
      { header: 'Nom *', key: 'nom', width: 30 },
      { header: 'Code (unique)', key: 'code', width: 15 },
      { header: 'Adresse', key: 'adresse', width: 40 },
      { header: 'Téléphone', key: 'telephone', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
    ];
    // Style header
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6E' } };
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    // Exemple
    ws.addRow({ nom: 'TechnoSmart SARL', code: 'TS01', adresse: '12 rue de la fibre, 69000 Lyon', telephone: '04 72 00 00 00', email: 'contact@technosmart.fr' });
    ws.addRow({ nom: 'Prestataire Réseau', code: 'PR02', adresse: '', telephone: '06 12 34 56 78', email: '' });

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-societes.xlsx"');
    res.send(buffer);
  }

  @Post('societes/import')
  @Roles('ADMIN', 'LOGISTICIEN_1')
  @UseInterceptors(FileInterceptor('file'))
  async importSocietes(@UploadedFile() file: Express.Multer.File) {
    return this.service.importSocietes(file.buffer);
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

  @Get('intervenants/template')
  @Roles('ADMIN', 'LOGISTICIEN_1')
  async templateIntervenants(@Res() res: Response) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Intervenants');
    ws.columns = [
      { header: 'Prénom *', key: 'prenom', width: 20 },
      { header: 'Nom *', key: 'nom', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Téléphone', key: 'telephone', width: 20 },
      { header: 'Code société', key: 'codeSociete', width: 15 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6E' } };
    // Note d'aide
    const noteWs = wb.addWorksheet('Info');
    noteWs.getCell('A1').value = 'Le champ "Code société" doit correspondre au code d\'une société existante dans le répertoire.';
    noteWs.getCell('A1').font = { italic: true };

    ws.addRow({ prenom: 'Jean', nom: 'Dupont', email: 'j.dupont@tech.fr', telephone: '06 12 34 56 78', codeSociete: 'TS01' });
    ws.addRow({ prenom: 'Marie', nom: 'Martin', email: '', telephone: '07 98 76 54 32', codeSociete: '' });

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-intervenants.xlsx"');
    res.send(buffer);
  }

  @Post('intervenants/import')
  @Roles('ADMIN', 'LOGISTICIEN_1')
  @UseInterceptors(FileInterceptor('file'))
  async importIntervenants(@UploadedFile() file: Express.Multer.File) {
    return this.service.importIntervenants(file.buffer);
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
