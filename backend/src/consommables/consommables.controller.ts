import {
  Controller, Get, Post, Put, Delete, Param, Body, Query,
  UseGuards, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ConsommablesService } from './consommables.service';
import { ConsommablesImportService } from './consommables-import.service';
import {
  QueryConsommablesDto, UpdateFormuleDto, CreateFormuleDto,
  AnalyseConsommablesDto, CommandesArticlesDto,
} from './dto/query-consommables.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const excelFilter = (_req: any, file: any, cb: any) => {
  if (/\.(xlsx|xls)$/i.test(file.originalname)) cb(null, true);
  else cb(new BadRequestException('Seuls les fichiers .xlsx / .xls sont acceptés'), false);
};

@UseGuards(JwtAuthGuard)
@Controller('consommables')
export class ConsommablesController {
  constructor(
    private readonly service: ConsommablesService,
    private readonly importService: ConsommablesImportService,
  ) {}

  // ── Lecture ─────────────────────────────────────────────────────────────────

  @Get('summary')
  summary() { return this.service.summary(); }

  @Get('imports')
  listImports() { return this.service.listImports(); }

  @Get('imports/:id/status')
  getImportStatus(@Param('id') id: string) { return this.importService.getImportStatus(id); }

  @Post('imports/:id/annuler')
  cancelImport(@Param('id') id: string) { return this.importService.cancelImport(id); }

  @Get('filters')
  getFilters() { return this.service.getFilters(); }

  @Get('calcul')
  calcul(@Query() query: QueryConsommablesDto) { return this.service.calcul(query); }

  @Get('repartition')
  repartition(@Query() query: QueryConsommablesDto) { return this.service.repartition(query); }

  @Get('formules')
  listFormules() { return this.service.listFormules(); }

  @Get('analyse')
  analyse(@Query() query: AnalyseConsommablesDto) { return this.service.analyse(query); }

  @Get('commandes-articles')
  commandesByArticle(@Query() query: CommandesArticlesDto) {
    return this.service.commandesByArticle(query.moisDebut, query.moisFin);
  }

  // ── Édition ─────────────────────────────────────────────────────────────────

  @Post('formules')
  createFormule(@Body() dto: CreateFormuleDto) {
    return this.service.createFormule(dto);
  }

  @Put('formules/:id')
  updateFormule(@Param('id') id: string, @Body() dto: UpdateFormuleDto) {
    return this.service.updateFormule(id, dto);
  }

  @Delete('formules/:id')
  deleteFormule(@Param('id') id: string) {
    return this.service.deleteFormule(id);
  }

  // ── Import ──────────────────────────────────────────────────────────────────

  @Post('import/interventions')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 600 * 1024 * 1024 }, // 600 MB
    fileFilter: excelFilter,
  }))
  async importInterventions(
    @UploadedFile() file: Express.Multer.File,
    @Query('force') force?: string,
  ) {
    if (!file) throw new BadRequestException('Fichier manquant (champ "file")');
    return this.importService.startInterventionsImport(file, force === 'true');
  }

  @Post('import/techniciens')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
    fileFilter: excelFilter,
  }))
  async importTechniciens(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fichier manquant (champ "file")');
    return this.importService.importTechniciens(file);
  }
}
