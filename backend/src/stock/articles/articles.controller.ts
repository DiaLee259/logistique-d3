import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';

@Controller('articles')
@UseGuards(JwtAuthGuard)
export class ArticlesController {
  constructor(private service: ArticlesService) {}

  @Get()
  findAll(@Query('entrepotId') entrepotId?: string) {
    return this.service.findAll(entrepotId);
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
