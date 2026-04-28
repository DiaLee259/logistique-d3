import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { MouvementsService } from './mouvements.service';
import { CreateMouvementDto } from './dto/create-mouvement.dto';
import { FilterMouvementsDto } from './dto/filter-mouvements.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('mouvements')
@UseGuards(JwtAuthGuard)
export class MouvementsController {
  constructor(private service: MouvementsService) {}

  @Get()
  findAll(@Query() filters: FilterMouvementsDto) {
    return this.service.findAll(filters);
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
