import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import * as ExcelJS from 'exceljs';

@Controller('articles')
@UseGuards(JwtAuthGuard)
export class ArticlesController {
  constructor(private service: ArticlesService) {}

  @Get('template')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'LOGISTICIEN_1')
  async templateArticles(@Res() res: Response) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Articles');
    ws.columns = [
      { header: 'Référence *', key: 'reference', width: 20 },
      { header: 'Nom *', key: 'nom', width: 35 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Unité', key: 'unite', width: 12 },
      { header: 'Seuil alerte', key: 'seuilAlerte', width: 15 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6E' } };
    ws.addRow({ reference: 'CAB-FO-G657', nom: 'Câble FO G657', description: 'Câble fibre optique monomode', unite: 'm', seuilAlerte: 100 });
    ws.addRow({ reference: 'CON-SC-APC', nom: 'Connecteur SC/APC', description: '', unite: 'pièce', seuilAlerte: 50 });
    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-articles.xlsx"');
    res.send(buffer);
  }

  @Post('import')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'LOGISTICIEN_1')
  @UseInterceptors(FileInterceptor('file'))
  async importArticles(@UploadedFile() file: Express.Multer.File) {
    return this.service.importArticles(file.buffer);
  }

  @Get()
  findAll(
    @Query('entrepotId') entrepotId?: string,
    @Query('includeInactif') includeInactif?: string,
  ) {
    return this.service.findAll(entrepotId, includeInactif === 'true');
  }

  @Get('stock')
  getStock(@Query('entrepotId') entrepotId?: string) {
    return this.service.getStockParArticle(entrepotId);
  }

  @Get('stats')
  getStats(
    @Query('entrepotId') entrepotId?: string,
    @Query('mois') mois?: string,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
    @Query('departement') departement?: string,
  ) {
    return this.service.getStats({ entrepotId, mois, dateDebut, dateFin, departement });
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'LOGISTICIEN_1')
  create(@Body() dto: CreateArticleDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'LOGISTICIEN_1')
  update(@Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
