import { Controller, Get, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ConsommablesService } from './consommables.service';
import { QueryConsommablesDto, UpdateFormuleDto, AnalyseConsommablesDto, CommandesArticlesDto } from './dto/query-consommables.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('consommables')
export class ConsommablesController {
  constructor(private readonly service: ConsommablesService) {}

  @Get('summary')
  summary() {
    return this.service.summary();
  }

  @Get('imports')
  listImports() {
    return this.service.listImports();
  }

  @Get('filters')
  getFilters() {
    return this.service.getFilters();
  }

  @Get('calcul')
  calcul(@Query() query: QueryConsommablesDto) {
    return this.service.calcul(query);
  }

  @Get('repartition')
  repartition(@Query() query: QueryConsommablesDto) {
    return this.service.repartition(query);
  }

  @Get('formules')
  listFormules() {
    return this.service.listFormules();
  }

  @Get('analyse')
  analyse(@Query() query: AnalyseConsommablesDto) {
    return this.service.analyse(query);
  }

  @Get('commandes-articles')
  commandesByArticle(@Query() query: CommandesArticlesDto) {
    return this.service.commandesByArticle(query.moisDebut, query.moisFin);
  }

  @Put('formules/:id')
  updateFormule(@Param('id') id: string, @Body() dto: UpdateFormuleDto) {
    return this.service.updateFormule(id, dto);
  }
}
